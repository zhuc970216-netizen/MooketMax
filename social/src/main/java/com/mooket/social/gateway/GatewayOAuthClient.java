package com.mooket.social.gateway;

import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Gateway OAuth 客户端
 * 对标 RN 项目 MooketQuant-mobile/src/api/auth.ts
 * 完整调用 gateway.mujidigital.com/uac 的所有认证接口
 */
@Component
public class GatewayOAuthClient {

    private static final String GATEWAY_BASE_URL = "https://gateway.mujidigital.com";
    private static final String UAC_BASE = GATEWAY_BASE_URL + "/uac";
    private static final String BASIC_AUTH = "Basic bWFsbGVlLW11amktdWFjOm1hbGlTb2FDbGllbnRTZWNyZXQ=";
    private static final String SMS_AES_KEY = "pK7BWDVdX4WnARTE";

    private final org.springframework.web.client.RestTemplate restTemplate;

    public GatewayOAuthClient() {
        this.restTemplate = new org.springframework.web.client.RestTemplate();
    }

    /**
     * 检查账号是否被禁用
     * GET /noAuth/userDisableInfo/{mobile}
     * 对标 RN：非200或result为空都视为"未禁用"，只有明确isDisable=true才抛异常
     */
    public boolean isUserDisabled(String mobile) {
        String url = UAC_BASE + "/noAuth/userDisableInfo/" + mobile;
        Map<String, Object> headers = buildHeaders(null);
        Map<String, Object> response = doGet(url, headers);
        if ((Integer) response.getOrDefault("code", 0) != 200) {
            return false;
        }
        Map<String, Object> result = (Map<String, Object>) response.get("result");
        if (result == null) {
            return false;
        }
        Boolean isDisable = (Boolean) result.get("isDisable");
        return Boolean.TRUE.equals(isDisable);
    }

    /**
     * 检查手机号注册状态
     * GET /noAuth/mobileRegisterCheck/{mobile}
     * @return {isRegistered, isInviteCheck}
     */
    public MobileRegisterCheckResult checkMobileRegister(String mobile) {
        String url = UAC_BASE + "/noAuth/mobileRegisterCheck/" + mobile;
        Map<String, Object> headers = buildHeaders(null);
        Map<String, Object> response = doGet(url, headers);
        if ((Integer) response.getOrDefault("code", 0) != 200) {
            throw new GatewayException("检查注册状态失败: " + response.get("message"));
        }
        Map<String, Object> result = (Map<String, Object>) response.get("result");
        return new MobileRegisterCheckResult(
            Boolean.TRUE.equals(result.get("isRegistered")),
            Boolean.TRUE.equals(result.get("isInviteCheck"))
        );
    }

    /**
     * 发送短信验证码
     * POST /auth/code/sms?mobile={encryptedMobile}
     */
    public void sendSmsCode(String mobile, String deviceId) throws GatewayException {
        String encryptedMobile = encryptMobile(mobile);
        String url = UAC_BASE + "/auth/code/sms?mobile=" + URLEncoder.encode(encryptedMobile, StandardCharsets.UTF_8);
        Map<String, Object> headers = buildHeaders(deviceId);
        Map<String, Object> response = doPost(url, headers, null);
        System.out.println("[GatewayOAuthClient] sendSmsCode completed, code="
                + response.getOrDefault("code", 0));
        if ((Integer) response.getOrDefault("code", 0) != 200) {
            throw new GatewayException("发送验证码失败: " + response.get("message"));
        }
    }

    /**
     * 短信验证码登录
     * POST /oauth/token?grant_type=sms_code&mobile=&smsCode=&...
     */
    public GatewayTokenResult loginWithSmsCode(String mobile, String smsCode, String clientId, String deviceId) {
        String params = "grant_type=sms_code&mobile=" + mobile + "&smsCode=" + smsCode
            + "&registerSource=1&registerMode=1&oneClickLogin=1";
        String url = UAC_BASE + "/oauth/token?" + params;
        Map<String, Object> headers = buildHeaders(deviceId);
        Map<String, Object> response = doPost(url, headers, null);
        return parseTokenResponse(response);
    }

    /**
     * 完善用户资料（首次注册登录后）
     * POST /finishBootstrap
     */
    public void finishBootstrap(
            String accessToken,
            String nickname,
            java.util.List<Integer> industryIdentityList,
            java.util.List<Integer> userLabelIdentityList,
            java.util.List<Integer> goodsCategoryList) {
        String url = UAC_BASE + "/finishBootstrap";
        Map<String, Object> headers = buildHeaders("server");
        headers.put("Authorization", "Bearer " + accessToken);
        headers.remove("noAuth");
        Map<String, Object> body = new HashMap<>();
        body.put("nickName", nickname);
        body.put("userIdentityList", industryIdentityList);
        body.put("userLabelIdentityList", userLabelIdentityList);
        body.put("goodsCategoryList", goodsCategoryList);
        Map<String, Object> response = doPost(url, headers, body);
        if ((Integer) response.getOrDefault("code", 0) != 200) {
            throw new GatewayException("完善资料失败: " + response.get("message"));
        }
    }

    // ================== 私有方法 ==================

    private Map<String, Object> buildHeaders(String deviceId) {
        Map<String, Object> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Authorization", BASIC_AUTH);
        headers.put("noAuth", "1");
        headers.put("deviceId", deviceId != null ? deviceId : "server");
        headers.put("deviceType", "Android");
        headers.put("deviceMac", deviceId != null ? deviceId : "server");
        headers.put("isPc", "0");
        headers.put("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36");
        headers.put("Referer", GATEWAY_BASE_URL);
        headers.put("Origin", GATEWAY_BASE_URL);
        return headers;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> doGet(String url, Map<String, Object> headers) {
        try {
            org.springframework.http.HttpHeaders httpHeaders = new org.springframework.http.HttpHeaders();
            headers.forEach((k, v) -> httpHeaders.add(k, String.valueOf(v)));
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(httpHeaders);
            org.springframework.http.ResponseEntity<String> response = restTemplate.exchange(
                url, org.springframework.http.HttpMethod.GET, entity, String.class);
            return parseJson(response.getBody());
        } catch (GatewayException e) {
            throw e;
        } catch (Exception e) {
            throw new GatewayException("网关请求失败: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> doPost(String url, Map<String, Object> headers, Map<String, Object> body) {
        try {
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            if (headers != null) {
                headers.forEach((key, value) -> {
                    if (key != null && value != null) {
                        conn.setRequestProperty(key, String.valueOf(value));
                    }
                });
            }
            if (body != null) {
                String jsonBody = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(body);
                conn.getOutputStream().write(jsonBody.getBytes("UTF-8"));
            }
            int responseCode = conn.getResponseCode();
            java.io.InputStream stream = responseCode >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (stream == null) {
                throw new GatewayException("网关请求失败: empty response stream, status=" + responseCode);
            }
            java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(stream, "UTF-8"));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            Map<String, Object> parsedResponse = parseJson(response.toString());
            System.out.println("[GatewayOAuthClient] HTTP " + responseCode + ", businessCode="
                    + parsedResponse.getOrDefault("code", 0));
            return parsedResponse;
        } catch (GatewayException e) {
            throw e;
        } catch (Exception e) {
            throw new GatewayException("网关请求失败: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
        } catch (Exception e) {
            throw new GatewayException("解析响应失败: " + json, e);
        }
    }

    private GatewayTokenResult parseTokenResponse(Map<String, Object> response) {
        Integer code = (Integer) response.getOrDefault("code", 0);
        if (code != 200) {
            String message = String.valueOf(response.get("message"));
            throw new GatewayException("登录失败: " + message);
        }
        Object resultObj = response.get("result");
        if (resultObj == null) {
            throw new GatewayException("登录失败: 无返回结果");
        }
        Map<String, Object> result = (Map<String, Object>) resultObj;
        String accessToken = String.valueOf(result.get("access_token"));
        if (accessToken == null || accessToken.isEmpty() || "null".equals(accessToken)) {
            throw new GatewayException("登录失败: 无accessToken");
        }
        Object userIdObj = result.get("userId");
        String userId = userIdObj != null ? String.valueOf(userIdObj) : null;
        return new GatewayTokenResult(accessToken, userId, result);
    }

    private String encryptMobile(String mobile) {
        try {
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/ECB/PKCS5Padding");
            javax.crypto.spec.SecretKeySpec keySpec = new javax.crypto.spec.SecretKeySpec(
                SMS_AES_KEY.getBytes("UTF-8"), "AES");
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, keySpec);
            byte[] encrypted = cipher.doFinal(mobile.getBytes("UTF-8"));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new GatewayException("手机号加密失败", e);
        }
    }

    // ================== 数据结构 ==================

    public static class MobileRegisterCheckResult {
        public final boolean isRegistered;
        public final boolean isInviteCheck;
        public MobileRegisterCheckResult(boolean isRegistered, boolean isInviteCheck) {
            this.isRegistered = isRegistered;
            this.isInviteCheck = isInviteCheck;
        }
    }

    public static class GatewayTokenResult {
        public final String accessToken;
        public final String userId;
        public final Map<String, Object> rawResult;
        public GatewayTokenResult(String accessToken, String userId, Map<String, Object> rawResult) {
            this.accessToken = accessToken;
            this.userId = userId;
            this.rawResult = rawResult;
        }
    }

    public static class GatewayException extends RuntimeException {
        public GatewayException(String message) { super(message); }
        public GatewayException(String message, Throwable cause) { super(message, cause); }
    }
}
