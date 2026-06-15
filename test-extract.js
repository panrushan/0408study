function extractIngredientsFromOCR(rawText) {
  if (!rawText) return '';
  let text = rawText.replace(/\r/g, '\n');

  const startPatterns = [
    /(?:^|\s)成分[：:\s]+([\s\S]*)/im,
    /(?:^|\s)配料[：:\s]+([\s\S]*)/im,
    /(?:^|\s)INGREDIENTS?[：:\s]+([\s\S]*)/im,
    /(?:^|\s)全成分[：:\s]+([\s\S]*)/im,
  ];
  let extracted = '';
  for (const pat of startPatterns) {
    const m = text.match(pat);
    if (m && m[1]) { extracted = m[1]; break; }
  }
  if (!extracted) extracted = text;

  const stopPatterns = [
    /使用方法/i, /注意事项/i, /贮存/i, /保存/i,
    /生产许可证/i, /执行标准/i, /备案编号/i,
    /地址[：:]/i, /电话[：:]/i, /邮编[：:]/i, /传真[：:]/i,
    /净含量[：:]/i, /保质期/i, /生产日期/i, /批号/i,
    /委托方/i, /被委托方/i, /产地[：:]/i, /制造商/i,
    /www\./i, /http/i, /客服/i, /热线/i,
  ];
  const lines = extracted.split('\n');
  const filteredLines = [];
  for (const line of lines) {
    const trim = line.trim();
    if (!trim) continue;
    let stop = false;
    for (const sp of stopPatterns) { if (sp.test(trim)) { stop = true; break; } }
    if (stop) break;
    filteredLines.push(trim);
  }

  let merged = filteredLines.join('、');

  const badPatterns = [
    /^公司/, /有限公司$/, /实业/, /集团/, /厂$/,
    /地址[：:]/, /电话[：:]/, /邮编[：:]/, /传真[：:]/, /网址/,
    /净含量[：:]/, /规格[：:]/, /型号[：:]/, /批号[：:]/, /保质期/,
    /使用方法[：:]/, /注意事项[：:]/, /贮存[：:]/, /保存条件/,
    /^见包装/, /^见瓶身/, /^详见/, /^如有/, /^请勿/,
  ];

  const protected = merged
    .replace(/(\d),(\d)/g, '$1##COMMA##$2')
    .split(/[、，,；;]/);

  const validItems = [];
  for (const item of protected) {
    const t = item.replace(/##COMMA##/g, ',').trim();
    if (!t || t.length > 40) continue;

    let bad = false;
    for (const bp of badPatterns) { if (bp.test(t)) { bad = true; break; } }
    if (bad) continue;

    validItems.push(t);
  }

  const originalItems = merged.split(/[、，,；;]/).filter(s => s.trim());
  if (validItems.length < 5 || validItems.length < originalItems.length * 0.3) {
    console.log('[OCR后处理] 过滤后成分太少，返回原始文本');
    return originalItems.join('、');
  }

  return validItems.join('、');
}

const rawText = `水、咖啡因、烟酰胺、乙氧基二甘醇、聚二甲基硅氧烷、硅
石、丁二醇、环糊精、表棓儿茶酚棓酸酯、鲸蜡硬脂醇橄榄
油酸酯、山梨坦橄榄油酸酯、硬脂醇、红没药醇、1,2-己二
醇、对羟基苯乙酮、柠檬酸三乙酯、白藜芦醇
其他微量成分：卡波姆钠、焦亚硫酸钠、EDTA二钠、麦芽
提取物、10-羟基癸酸`;

const result = extractIngredientsFromOCR(rawText);
console.log('提取结果:', result);
console.log('成分数量:', result.split('、').length);
