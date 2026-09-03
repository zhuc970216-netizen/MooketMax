package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import com.mooket.social.common.JwtUtil;
import com.mooket.social.gateway.GatewayOAuthClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Local auth controller - uses real gateway for SMS, local DB for user
 */
@RestController
@RequestMapping("/api/v1/auth")
public class LocalAuthController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private GatewayOAuthClient gatewayOAuthClient;

    private final Map<String, Long> smsCooldownStore = new ConcurrentHashMap<>();

    @PostMapping("/send-code")
    public ApiResponse<Map<String, Object>> sendCode(
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Device-Id", required = false) String deviceId) {

        String phone = request.get("phone");
        if (phone == null || phone.length() != 11) {
            return ApiResponse.error(400, "手机号格式错误");
        }

        Long cooldownEnd = smsCooldownStore.get(phone);
        if (cooldownEnd != null && System.currentTimeMillis() < cooldownEnd) {
            return ApiResponse.error(400, "请稍后再试");
        }

        try {
            GatewayOAuthClient.MobileRegisterCheckResult registerCheck =
                    gatewayOAuthClient.checkMobileRegister(phone);

            String realDeviceId = deviceId != null ? deviceId : "server";
            gatewayOAuthClient.sendSmsCode(phone, realDeviceId);

            smsCooldownStore.put(phone, System.currentTimeMillis() + 60000);

            Map<String, Object> data = new HashMap<>();
            data.put("message", "验证码已发送");
            data.put("isRegistered", registerCheck.isRegistered);
            data.put("clientId", String.valueOf(System.currentTimeMillis()));
            return ApiResponse.success(data);
        } catch (GatewayOAuthClient.GatewayException e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String code = request.get("code");
        String clientId = request.get("clientId");
        String deviceId = request.get("deviceId");

        if (phone == null || code == null) {
            return ApiResponse.error(400, "参数不完整");
        }
        if (!phone.matches("^1[3-9]\\d{9}$")) {
            return ApiResponse.error(400, "手机号格式错误");
        }
        if (!code.matches("^\\d{4,6}$")) {
            return ApiResponse.error(400, "请输入正确的验证码");
        }

        try {
            String realDeviceId = deviceId != null ? deviceId : "server";
            GatewayOAuthClient.GatewayTokenResult tokenResult =
                    gatewayOAuthClient.loginWithSmsCode(phone, code, clientId, realDeviceId);

            // 同步用户到本地 dict_user 表
            Long userId = syncUserToLocal(phone, tokenResult);
            String jwtToken = JwtUtil.generateToken(userId, phone);
            smsCooldownStore.remove(phone);

            Map<String, Object> data = new HashMap<>();
            data.put("token", jwtToken);
            data.put("isNewUser", false);
            data.put("userId", userId);
            data.put("phone", phone);
            data.put("nickname", "用户" + phone.substring(7));
            data.put("gatewayAccessToken", tokenResult.accessToken);
            data.put("gatewayUserId", tokenResult.userId);
            return ApiResponse.success(data);
        } catch (GatewayOAuthClient.GatewayException e) {
            return ApiResponse.error(401, e.getMessage());
        }
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> request) {

        String token = authHeader.replace("Bearer ", "");
        JwtUtil.ValidationResult validation = JwtUtil.validateTokenDetailed(token);
        if (!validation.isValid()) {
            return ApiResponse.error(401, validation.getMessage());
        }

        String phone = JwtUtil.getPhone(token);
        String nickname = (String) request.get("nickname");
        String gatewayAccessToken = (String) request.get("gatewayAccessToken");

        if (nickname == null || nickname.length() < 2 || nickname.length() > 20) {
            return ApiResponse.error(400, "昵称需为 2-20 个字符");
        }
        if (gatewayAccessToken == null || gatewayAccessToken.isEmpty()) {
            return ApiResponse.error(400, "缺少 gatewayToken");
        }

        try {
            // 更新本地用户昵称
            jdbcTemplate.update(
                "UPDATE dict_user SET nickname = ?, update_time = ? WHERE mobile = ?",
                nickname, LocalDateTime.now(), phone);

            String jwtToken = JwtUtil.generateToken(getUserIdByPhone(phone), phone);

            Map<String, Object> data = new HashMap<>();
            data.put("message", "注册成功");
            data.put("token", jwtToken);
            data.put("userId", getUserIdByPhone(phone));
            data.put("phone", phone);
            data.put("nickname", nickname);
            data.put("gatewayAccessToken", gatewayAccessToken);
            return ApiResponse.success(data);
        } catch (Exception e) {
            return ApiResponse.error(400, e.getMessage());
        }
    }

    @GetMapping("/userinfo")
    public ApiResponse<Map<String, Object>> getUserInfo(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        JwtUtil.ValidationResult validation = JwtUtil.validateTokenDetailed(token);
        if (!validation.isValid()) {
            return ApiResponse.error(401, validation.getMessage());
        }

        String phone = JwtUtil.getPhone(token);
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT user_id, mobile, nickname FROM dict_user WHERE mobile = ?", phone);

        if (users.isEmpty()) {
            return ApiResponse.error(404, "用户不存在");
        }

        return ApiResponse.success(users.get(0));
    }

    private Long syncUserToLocal(String phone, GatewayOAuthClient.GatewayTokenResult tokenResult) {
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT user_id FROM dict_user WHERE mobile = ?", phone);

        if (users.isEmpty()) {
            jdbcTemplate.update(
                "INSERT INTO dict_user (mobile, nickname, create_time, update_time) VALUES (?, ?, ?, ?)",
                phone, "用户" + phone.substring(7), LocalDateTime.now(), LocalDateTime.now());
            users = jdbcTemplate.queryForList("SELECT user_id FROM dict_user WHERE mobile = ?", phone);
        }

        return ((Number) users.get(0).get("user_id")).longValue();
    }

    private Long getUserIdByPhone(String phone) {
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT user_id FROM dict_user WHERE mobile = ?", phone);
        if (users.isEmpty()) return null;
        return ((Number) users.get(0).get("user_id")).longValue();
    }
}