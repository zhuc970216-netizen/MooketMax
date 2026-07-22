import {analyzeOriginalText, buildOriginalTextPayload} from '../src/utils/originalText';

const mixedOfferAndInquiryText = `【整柜】
配额80%已公布，
涨价在即
🇧🇷2924精修大米龙
26-2，
一对一票，
上海整柜
59.3🔥
-----------
京和义史立恒
☎
17838327180
长期采购：巴西牛黑、
米龙、
后三、
后四、
后六`;

describe('original text matching', () => {
  it('prefers the purchase list over an earlier sale line for inquiry cards', () => {
    const payload = buildOriginalTextPayload({
      text: mixedOfferAndInquiryText,
      intent: 'inquiry',
      country: '巴西',
      productName: '米龙',
    });

    const result = analyzeOriginalText(payload.text, payload.keywords);
    const selectedText = result.bestSegmentIndexes.map(index => result.segments[index]).join('\n');

    expect(selectedText).toContain('长期采购：巴西牛黑、');
    expect(selectedText).toContain('米龙、');
    expect(selectedText).not.toContain('后三、');
    expect(selectedText).not.toContain('后四、');
    expect(selectedText).not.toContain('后六');
    expect(selectedText).not.toContain('🇧🇷2924精修大米龙');
  });

  it('expands rear-quarter set aliases when matching inquiry lists', () => {
    const payload = buildOriginalTextPayload({
      text: mixedOfferAndInquiryText,
      intent: 'inquiry',
      country: '巴西',
      productName: '牛后四件套',
    });

    const result = analyzeOriginalText(payload.text, payload.keywords);
    const selectedText = result.bestSegmentIndexes.map(index => result.segments[index]).join('\n');

    expect(selectedText).toContain('长期采购：巴西牛黑、');
    expect(selectedText).toContain('米龙、');
    expect(selectedText).not.toContain('🇧🇷2924精修大米龙');
  });

  it('highlights only the precise factory and product row in a purchase list', () => {
    const text = `求购
411腱肉
5125黑帮肉
2583小块腱肉
2437大米龙
2471肩部肋条
哥8/12牛腿骨
☎13916611908`;

    const payload = buildOriginalTextPayload({
      text,
      intent: 'inquiry',
      country: '巴西',
      factoryNo: 'SIF2437',
      productName: '大米龙',
    });

    const result = analyzeOriginalText(payload.text, payload.keywords);
    const selectedText = result.bestSegmentIndexes.map(index => result.segments[index]).join('\n');

    expect(result.bestSegmentIndexes).toHaveLength(1);
    expect(selectedText).toBe('2437大米龙');
  });

  it('prefers the country and product row over other product-like rows', () => {
    const text = `长期求购:巴西牛前后,
胎肋，
阿根廷肋排，
挑肥肋排
3225牛腩，
47.8`;

    const payload = buildOriginalTextPayload({
      text,
      intent: 'inquiry',
      country: '阿根廷',
      productName: '肋排',
    });

    const result = analyzeOriginalText(payload.text, payload.keywords);
    const selectedText = result.bestSegmentIndexes.map(index => result.segments[index]).join('\n');

    expect(selectedText).toBe(`长期求购:巴西牛前后,
阿根廷肋排，`);
    expect(selectedText).not.toContain('胎肋');
    expect(selectedText).not.toContain('挑肥肋排');
  });
  it('prefers the compact country factory product row for merchant offer text', () => {
    const text = `都有空间 你出价我申请 物流港现货 联系电话：15037039125
🇦🇷4407前腱69.5
🇨🇴680大肩胛56
🇧🇷2058牛腩49
🇧🇷4554保乐肩54.5
🇦🇷1014五肋排41（瘦）
🇦🇷1014四肋排40.5（瘦）
🇺🇾乌拉圭7 5肋排42.5
🇧🇷2543胸肉50
🇧🇷2543板腱68
🇧🇷1925前腱66
🇧🇷1925板腱67
🇧🇴玻6全牛
🇧🇴玻6腱子肉~58.5
🇧🇴玻6大米龙65
🇧🇴玻6牛霖59.5
物流港现货 大单可以 联系电话15037039125`;

    const payload = buildOriginalTextPayload({
      text,
      intent: 'offer',
      country: '玻利维亚',
      factoryNo: '08-01-03-02-0006',
      productName: '全牛',
    });

    const result = analyzeOriginalText(payload.text, payload.keywords);
    const selectedText = result.bestSegmentIndexes.map(index => result.segments[index]).join('\n');

    expect(result.bestSegmentIndexes).toHaveLength(1);
    expect(selectedText).toBe('🇧🇴玻6全牛');
  });
});
