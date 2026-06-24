/* ================================
   安肌成分检测 - 核心逻辑 v3
   新增：图片裁剪框、图像预处理、英文自动翻译
   ================================ */

let currentResult = null;
let profile = loadProfile();
let historyData = loadHistory();

// ========== 页面切换（带离场过渡） ==========
function goPage(pageName) {
  const current = document.querySelector('.page.active');
  const target = document.getElementById('page-' + pageName);
  if (!target || current === target) return;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (navBtn) navBtn.classList.add('active');

  const switchOver = () => {
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active', 'leaving');
    });
    target.classList.add('active');
    if (pageName === 'history') renderHistory();
    if (pageName === 'profile') renderProfile();
    if (pageName === 'result' && window.SkincareTilt) {
      // 重新观察动态渲染的卡片
      setTimeout(() => window.SkincareTilt.initReveal(), 50);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (current) {
    current.classList.add('leaving');
    current.addEventListener('animationend', switchOver, { once: true });
    // 兜底：万一 animationend 没触发
    setTimeout(switchOver, 260);
  } else {
    switchOver();
  }
}

// ========== Toast 提示 ==========
function showToast(msg, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type ? 'toast-' + type : '');
  const icon = type === 'success' ? '✓ ' : type === 'warn' ? '⚠ ' : type === 'error' ? '✕ ' : '';
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2600);
}

// ========== 底部确认条（替代 confirm） ==========
function showConfirmSheet(title, desc, onConfirm) {
  const existing = document.querySelector('.confirm-sheet');
  if (existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet';
  sheet.innerHTML = `
    <div class="confirm-sheet-title">${title}</div>
    <div class="confirm-sheet-desc">${desc}</div>
    <div class="confirm-sheet-actions">
      <button class="btn btn-outline">取消</button>
      <button class="btn btn-primary">确认</button>
    </div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  const [cancelBtn, okBtn] = sheet.querySelectorAll('button');
  const close = () => {
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 360);
  };
  cancelBtn.onclick = close;
  okBtn.onclick = () => { close(); onConfirm && onConfirm(); };
}

// ========== OCR 后处理：只提取成分 ==========
function extractIngredientsFromOCR(rawText) {
  if (!rawText) return '';
  let text = rawText.replace(/\r/g, '\n');

  // 1. 尝试定位"成分"段落开头
  // 注意：要匹配"成分："作为一个独立词，不能误匹配"其他微量成分"里的"成分"
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

  // 2. 截断：遇到明显非成分段落就停止
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

  // 3. 修复被换行打断的成分（如上一行末尾是"1,2-己二"，下一行开头是"醇"）
  const endWords = ['醇', '酸', '酯', '油', '胺', '酮', '醛', '醚', '酚', '素', '钠', '钾', '钙', '镁', '锌', '根', '盐'];
  for (let i = 0; i < filteredLines.length - 1; i++) {
    const current = filteredLines[i];
    const next = filteredLines[i + 1];
    if (!current || !next) continue;
    const currentItems = current.split(/[、，,]/);
    const lastItem = currentItems[currentItems.length - 1].trim();
    const lastChar = lastItem.slice(-1);
    const nextItems = next.split(/[、，,]/);
    const firstItem = nextItems[0].trim();
    const firstChar = firstItem.slice(0, 1);
    if (!endWords.includes(lastChar) && endWords.includes(firstChar) && lastItem.length < 12) {
      filteredLines[i] = currentItems.slice(0, -1).join('、') + (currentItems.length > 1 ? '、' : '') + lastItem + firstItem;
      filteredLines[i + 1] = nextItems.slice(1).join('、');
    }
  }

  // 4. 合并多行。优先用顿号连接，保留逗号在成分内部（如1,2-己二醇）
  let merged = filteredLines.join('、');

  // 5. 只删除最明显不是成分的条目（公司名、地址、规格等）
  const badPatterns = [
    /^公司/, /有限公司$/, /实业/, /集团/, /厂$/,
    /地址[：:]/, /电话[：:]/, /邮编[：:]/, /传真[：:]/, /网址/,
    /净含量[：:]/, /规格[：:]/, /型号[：:]/, /批号[：:]/, /保质期/,
    /使用方法[：:]/, /注意事项[：:]/, /贮存[：:]/, /保存条件/,
    /^见包装/, /^见瓶身/, /^详见/, /^如有/, /^请勿/,
  ];

  // 5. 分割。化妆品成分表通常用"、"或"，"分隔，
  //    但"1,2-己二醇"中的逗号要保留，所以先保护数字逗号
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

  // 6. 如果过滤后太少（少于原始条目的一半），直接返回原始合并文本
  const originalItems = merged.split(/[、，,；;]/).filter(s => s.trim());
  if (validItems.length < 5 || validItems.length < originalItems.length * 0.3) {
    console.log('[OCR后处理] 过滤后成分太少，返回原始文本');
    return originalItems.join('、');
  }

  return validItems.join('、');
}

// ========== 成分解析引擎 ==========
function parseIngredients(text) {
  if (!text || !text.trim()) return [];
  let cleaned = text.replace(/[、，,;；|\\/]/g, ',').replace(/[（(].*?[)）]/g, '').replace(/\s+/g, ' ').trim();
  const rawList = cleaned.split(/[,\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  const results = [];
  for (const raw of rawList) {
    const item = matchIngredient(raw);
    results.push({ raw: raw, ...item });
  }
  return results;
}

function matchIngredient(rawText) {
  const text = rawText.toLowerCase().trim();
  if (INGREDIENT_DB[text]) return { matched: true, key: text, ...INGREDIENT_DB[text] };
  for (const [key, data] of Object.entries(INGREDIENT_DB)) {
    if (text.includes(key) || key.includes(text)) return { matched: true, key: key, ...data };
    if (data.name && text.includes(data.name.toLowerCase())) return { matched: true, key: key, ...data };
  }
  return { matched: false, name: rawText, level: 0, type: "未知成分", reason: "暂无该成分的风险数据" };
}

// ========== 成分冲突/协同检测 ==========
const CONFLICT_RULES = [
  { ids: ['acid_group'], check: (ings) => {
    const acids = ings.filter(i => i.type === '果酸' || i.type === '水杨酸');
    return acids.length >= 2 ? `检测到 ${acids.length} 种酸类成分叠加，剥脱过度易损伤屏障，建议分开使用或降低频率` : null;
  }},
  { ids: ['retinol_group'], check: (ings) => {
    const retins = ings.filter(i => i.type === '维A类' && i.level >= 3);
    return retins.length >= 2 ? `检测到多种维A类成分叠加，刺激性过强，建议只保留一种` : null;
  }},
  { ids: ['alcohol_acid'], check: (ings) => {
    const hasAlcohol = ings.some(i => i.type === '酒精');
    const hasAcid = ings.some(i => i.type === '果酸' || i.type === '水杨酸');
    return (hasAlcohol && hasAcid) ? `酒精+酸类同时存在，双重剥脱破坏屏障，极度不建议敏感肌使用` : null;
  }},
  { ids: ['alcohol_retinol'], check: (ings) => {
    const hasAlcohol = ings.some(i => i.type === '酒精');
    const hasRetinol = ings.some(i => i.type === '维A类' && i.level >= 3);
    return (hasAlcohol && hasRetinol) ? `酒精+维A类叠加，干燥和刺激风险加倍，干敏肌请避开` : null;
  }},
  { ids: ['sls_acid'], check: (ings) => {
    const hasSLS = ings.some(i => i.type === '清洁表活' && i.level >= 3);
    const hasAcid = ings.some(i => i.type === '果酸' || i.type === '水杨酸');
    return (hasSLS && hasAcid) ? `强效清洁表活+酸类叠加，洁面后酸类进一步剥脱，屏障负担过重` : null;
  }},
  { ids: ['fragrance_sensitive'], check: (ings) => {
    const frags = ings.filter(i => i.type === '香精');
    const hasSens = profile.skinTypes && profile.skinTypes.includes('sensitive');
    return (frags.length > 0 && hasSens) ? `敏感肌+香精：香精是敏感肌最常见过敏原之一，建议优先选择无香精产品` : null;
  }},
];

function detectConflicts(ingredients) {
  const alerts = [];
  for (const rule of CONFLICT_RULES) {
    const msg = rule.check(ingredients);
    if (msg) alerts.push(msg);
  }
  return alerts;
}

// ========== 个性化评分算法 ==========
function calculateScore(ingredients) {
  const p = profile;
  let score = 100;
  let riskCount = { safe: 0, low: 0, medium: 0, high: 0, banned: 0 };
  let personalizedAlerts = [];
  let deductedTypes = new Set();

  for (const ing of ingredients) {
    let level = ing.level;
    if (p.skinTypes && p.skinTypes.includes('sensitive')) {
      if (ing.type === '酒精' || ing.type === '香精' || ing.type === '果酸' || ing.type === '水杨酸') {
        if (level < 4) level += 1;
      }
    }
    if (p.skinTypes && p.skinTypes.includes('acne')) {
      if (ing.type === '致痘成分' || ing.type === '潜在致痘') {
        if (level < 4) level += 1;
      }
    }
    if (p.skinTypes && p.skinTypes.includes('dry')) {
      if (ing.type === '清洁表活' && ing.level >= 3) {
        if (level < 5) level += 1;
      }
    }
    if (p.specialStatus && p.specialStatus.includes('pregnant')) {
      if (ing.type === '维A类' || ing.key === 'hydroquinone' || ing.key === 'salicylic acid') {
        level = 5;
        if (!personalizedAlerts.includes('孕期禁用')) personalizedAlerts.push('孕期禁用');
      }
    }
    if (p.allergies && p.allergies.length > 0) {
      for (const allergy of p.allergies) {
        const a = allergy.toLowerCase();
        if (ing.key === a || ing.name.toLowerCase().includes(a) || ing.raw.toLowerCase().includes(a)) {
          level = 5;
          personalizedAlerts.push(`过敏成分: ${allergy}`);
          break;
        }
      }
    }
    if (level === 0) riskCount.safe++;
    else if (level === 1) riskCount.safe++;
    else if (level === 2) riskCount.low++;
    else if (level === 3) riskCount.medium++;
    else if (level === 4) riskCount.high++;
    else if (level >= 5) riskCount.banned++;

    const typeKey = ing.type + '-' + level;
    if (!deductedTypes.has(typeKey)) {
      if (level === 2) score -= 3;
      else if (level === 3) score -= 8;
      else if (level === 4) score -= 15;
      else if (level >= 5) score -= 25;
      deductedTypes.add(typeKey);
    } else {
      if (level >= 4) score -= 3;
      else if (level === 3) score -= 2;
    }
    ing.adjustedLevel = level;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, riskCount, personalizedAlerts };
}

function getScoreComment(score) {
  if (score >= 90) return { text: '非常安全 ✅', class: 'score-excellent', detail: '成分温和，敏感肌放心使用' };
  if (score >= 75) return { text: '较为安全 ✓', class: 'score-good', detail: '整体安全，含少量需注意成分' };
  if (score >= 60) return { text: '谨慎使用 ⚠️', class: 'score-warning', detail: '含一定风险成分，敏感肌需留意' };
  if (score >= 40) return { text: '风险较高 ❗', class: 'score-warning', detail: '含较多刺激成分，敏感肌建议避开' };
  return { text: '不建议使用 ❌', class: 'score-danger', detail: '含高风险或禁用成分，请谨慎' };
}

// ========== 分析主流程 ==========
function analyzeText() {
  const input = document.getElementById('ingredient-input').value;
  if (!input.trim()) { showToast('请先输入成分表', 'warn'); return; }

  const btn = document.getElementById('analyze-btn');
  setButtonLoading(btn, true);

  // 模拟短暂加载，增强交互感
  setTimeout(() => {
    runAnalysis(input);
    setButtonLoading(btn, false);
  }, 400);
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.dataset.originalText = btn.innerHTML;
  } else {
    btn.classList.remove('loading');
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

function runAnalysis(text, source = 'text') {
  const ingredients = parseIngredients(text);
  const { score, riskCount, personalizedAlerts } = calculateScore(ingredients);
  const comment = getScoreComment(score);
  const conflicts = detectConflicts(ingredients);
  currentResult = {
    id: Date.now(), date: new Date().toLocaleString('zh-CN'),
    productName: source === 'ocr' ? '图片识别产品' : '手动输入产品',
    score, riskCount, ingredients, personalizedAlerts, comment, conflicts
  };
  renderResult(currentResult);
  goPage('result');

  // 安全分数高时撒花庆祝
  if (currentResult.score >= 80) {
    setTimeout(() => {
      fireConfetti();
      showCelebrateBadge(currentResult.score >= 90 ? '成分很温和 🌿' : '整体较安全 ✨');
    }, 1400);
  }
}

// ========== 渲染报告 ==========
function renderResult(result) {
  const circle = document.getElementById('score-circle');
  const scoreNumEl = document.getElementById('score-num');
  const scoreCommentEl = document.getElementById('score-comment');
  const scoreDetailEl = document.getElementById('score-detail');

  // 重置：先归零，再做动画
  circle.className = 'score-circle ' + result.comment.class;
  circle.style.setProperty('--score-deg', '0deg');
  scoreNumEl.textContent = '0';
  scoreCommentEl.textContent = '';
  scoreDetailEl.textContent = '';

  // 评分数字 + 圆环弧度 同步缓动
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 0 : 1200;
  const startT = performance.now();
  const target = result.score;
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const animateScore = (now) => {
    const elapsed = now - startT;
    const t = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    const val = Math.round(target * eased);
    scoreNumEl.textContent = val;
    circle.style.setProperty('--score-deg', (val / 100 * 360) + 'deg');
    if (t < 1) {
      requestAnimationFrame(animateScore);
    } else {
      scoreNumEl.textContent = target;
      circle.style.setProperty('--score-deg', (target / 100 * 360) + 'deg');
      scoreCommentEl.textContent = result.comment.text;
      scoreDetailEl.textContent = result.comment.detail;
    }
  };
  requestAnimationFrame(animateScore);

  // 统计条：stagger 生长 + 数字滚动
  const total = result.ingredients.length || 1;
  const setStat = (id, count, delay) => {
    const fill = document.getElementById('stat-' + id);
    const countEl = document.getElementById('count-' + id);
    fill.style.width = '0%';
    countEl.textContent = '0';
    const targetW = (count / total * 100);
    const numDuration = 700;
    const numStart = performance.now() + delay;
    const numAnim = (now) => {
      const t = Math.min(Math.max((now - numStart) / numDuration, 0), 1);
      const eased = easeOutCubic(t);
      countEl.textContent = Math.round(count * eased);
      if (t < 1) requestAnimationFrame(numAnim);
      else countEl.textContent = count;
    };
    setTimeout(() => {
      fill.style.width = targetW + '%';
      requestAnimationFrame(numAnim);
    }, delay);
  };
  setStat('safe', result.riskCount.safe, 120);
  setStat('low', result.riskCount.low, 200);
  setStat('medium', result.riskCount.medium, 280);
  setStat('high', result.riskCount.high, 360);
  setStat('banned', result.riskCount.banned, 440);

  const riskSummaryEl = document.getElementById('risk-summary');
  const risky = result.ingredients.filter(i => (i.adjustedLevel || i.level) >= 3);
  if (risky.length > 0) {
    const banned = risky.filter(i => (i.adjustedLevel || i.level) >= 5);
    const high = risky.filter(i => { const l = i.adjustedLevel || i.level; return l === 4; });
    const medium = risky.filter(i => { const l = i.adjustedLevel || i.level; return l === 3; });
    let html = `<div class="risk-summary-card ${banned.length > 0 ? 'banned' : ''}">`;
    html += `<div class="risk-summary-title">⚠️ 风险成分汇总</div>`;
    html += `<div class="risk-summary-list">`;
    if (banned.length > 0) html += `<div>⛔ 禁用级（${banned.length}种）：${banned.map(i => `<strong>${escapeHtml(i.name)}</strong>`).join('、')}</div>`;
    if (high.length > 0) html += `<div>🔴 高风险（${high.length}种）：${high.map(i => escapeHtml(i.name)).join('、')}</div>`;
    if (medium.length > 0) html += `<div>🟠 中风险（${medium.length}种）：${medium.map(i => escapeHtml(i.name)).join('、')}</div>`;
    html += `</div></div>`;
    riskSummaryEl.innerHTML = html;
  } else {
    riskSummaryEl.innerHTML = '';
  }

  const alertBox = document.getElementById('personal-alert');
  if (result.personalizedAlerts.length > 0) {
    const unique = [...new Set(result.personalizedAlerts)];
    alertBox.innerHTML = `<div class="alert-box danger"><span>⚠️</span><div><strong>基于你的肤质档案检测到：</strong><br>${unique.map(a => `• ${a}`).join('<br>')}</div></div>`;
  } else {
    alertBox.innerHTML = '';
  }

  const conflictEl = document.getElementById('conflict-alert');
  if (result.conflicts && result.conflicts.length > 0) {
    conflictEl.innerHTML = `<div class="conflict-box"><div class="conflict-box-title">⚡ 成分相互作用提醒</div><div>${result.conflicts.map(c => `• ${c}`).join('<br>')}</div></div>`;
  } else {
    conflictEl.innerHTML = '';
  }

  const catEl = document.getElementById('category-sections');
  const groups = {};
  for (const ing of result.ingredients) {
    const type = ing.type || '其他';
    if (!groups[type]) groups[type] = [];
    groups[type].push(ing);
  }
  const typeOrder = ['禁用成分','重金属','维A类','酒精','香精','防腐剂','清洁表活','果酸','水杨酸','致痘成分','潜在致痘','化学防晒','色素','硅类','溶剂','封闭剂','润肤','保湿','舒缓','修护','抗氧化','物理防晒','未知成分','其他'];
  const sortedTypes = Object.keys(groups).sort((a, b) => {
    const ia = typeOrder.indexOf(a); const ib = typeOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  let catHtml = '';
  for (const type of sortedTypes) {
    const items = groups[type];
    const maxLvl = Math.max(...items.map(i => i.adjustedLevel || i.level));
    const icon = maxLvl >= 5 ? '⛔' : maxLvl === 4 ? '🔴' : maxLvl === 3 ? '🟠' : maxLvl === 2 ? '🟡' : '🟢';
    catHtml += `<div class="category-section"><div class="category-title">${icon} ${type}（${items.length}种）</div><div class="tag-list">${items.map(i => {
      const l = i.adjustedLevel || i.level;
      const cls = l >= 5 ? 'danger-selected' : l >= 3 ? 'selected' : '';
      return `<span class="tag ${cls}" style="cursor:pointer;" onclick="openWiki('${escapeHtml(i.key || i.name)}')">${escapeHtml(i.name)}</span>`;
    }).join('')}</div></div>`;
  }
  catEl.innerHTML = catHtml;

  const listEl = document.getElementById('ingredient-list');
  const sorted = [...result.ingredients].sort((a, b) => (b.adjustedLevel || b.level) - (a.adjustedLevel || a.level));
  listEl.innerHTML = sorted.map(ing => {
    const lvl = ing.adjustedLevel || ing.level;
    const levelClass = lvl >= 5 ? 'banned' : lvl === 4 ? 'high' : lvl === 3 ? 'medium' : lvl === 2 ? 'low' : 'safe';
    const badgeClass = lvl >= 5 ? 'badge-banned' : lvl === 4 ? 'badge-high' : lvl === 3 ? 'badge-medium' : lvl === 2 ? 'badge-low' : 'badge-safe';
    const badgeText = lvl >= 5 ? '禁用' : lvl === 4 ? '高风险' : lvl === 3 ? '中风险' : lvl === 2 ? '低敏' : '安全';
    const wikiKey = ing.key || ing.name;
    const filterLevel = lvl >= 5 ? 'banned' : lvl === 4 ? 'danger' : lvl === 3 ? 'warning' : 'safe';
    return `<div class="ingredient-item ${levelClass}" data-level="${filterLevel}" onclick="openWiki('${escapeHtml(wikiKey)}')"><div class="ing-dot"></div><div class="ing-info"><div class="ing-name">${escapeHtml(ing.name)}<span class="ing-badge ${badgeClass}">${badgeText}</span></div><div class="ing-meta">${ing.type}${ing.matched ? '' : ' · 未收录'}</div><div class="ing-reason">${escapeHtml(ing.reason)}</div></div></div>`;
  }).join('');

  // 成分项 stagger 入场
  const items = listEl.querySelectorAll('.ingredient-item');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  items.forEach((el, i) => {
    if (reducedMotion) { el.classList.add('revealed'); return; }
    setTimeout(() => el.classList.add('revealed'), 120 + i * 55);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 百科弹窗 ==========
function openWiki(keyOrName) {
  const key = keyOrName.toLowerCase().trim();
  let data = INGREDIENT_DB[key];
  if (!data) {
    for (const [k, v] of Object.entries(INGREDIENT_DB)) {
      if (k.includes(key) || key.includes(k) || (v.name && v.name.toLowerCase().includes(key))) {
        data = v; break;
      }
    }
  }
  const modal = document.getElementById('wiki-modal');
  const title = document.getElementById('wiki-title');
  const body = document.getElementById('wiki-body');
  if (!data) {
    title.textContent = keyOrName;
    body.innerHTML = `<div class="wiki-section"><p>该成分暂未收录详细数据。</p></div>`;
  } else {
    title.textContent = data.name;
    const lvlClass = 'level' + data.level;
    const lvlText = data.level >= 5 ? '禁用' : data.level === 4 ? '高风险' : data.level === 3 ? '中风险' : data.level === 2 ? '低敏' : '安全';
    let html = `<div class="wiki-level ${lvlClass}">${lvlText}</div>`;
    html += `<div class="wiki-section"><div class="wiki-section-title">风险说明</div><p>${escapeHtml(data.reason)}</p></div>`;
    html += `<div class="wiki-section"><div class="wiki-section-title">成分类型</div><span class="wiki-tag">${data.type}</span></div>`;
    let skinAdvice = '';
    if (data.level <= 1) skinAdvice = '全肤质适用，包括敏感肌。';
    else if (data.level === 2) skinAdvice = '大部分肤质适用，极度敏感肌建议先局部测试。';
    else if (data.type === '酒精') skinAdvice = '油皮/混油可偶尔使用；干皮、敏感肌、屏障受损肌建议避开。';
    else if (data.type === '香精') skinAdvice = '敏感肌、皮炎肌建议避开；正常肤质通常无问题。';
    else if (data.type === '防腐剂') skinAdvice = '正常肤质通常耐受；敏感肌关注具体种类，苯氧乙醇相对温和。';
    else if (data.type === '清洁表活') skinAdvice = '油皮可偶尔使用；干皮、敏感肌建议选择氨基酸/APG类洁面。';
    else if (data.type === '果酸' || data.type === '水杨酸') skinAdvice = '油皮/痘肌适用；干敏肌需从低浓度开始建立耐受，或避开。';
    else if (data.type === '维A类') skinAdvice = '抗老需求适用；敏感肌需建立耐受，孕期/哺乳期禁用。';
    else if (data.type === '致痘成分' || data.type === '潜在致痘') skinAdvice = '痘肌/油皮建议避开；干皮非痘肌通常无大碍。';
    else if (data.level >= 4) skinAdvice = '敏感肌、受损肌建议避开；健康皮也建议控制使用频率。';
    else skinAdvice = '请根据自身肤质判断是否适用。';
    html += `<div class="wiki-section"><div class="wiki-section-title">适用肤质建议</div><p>${skinAdvice}</p></div>`;
    const alternatives = getAlternatives(data);
    if (alternatives) html += `<div class="wiki-section"><div class="wiki-section-title">温和替代建议</div><p>${alternatives}</p></div>`;
    body.innerHTML = html;
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWiki(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('wiki-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function getAlternatives(data) {
  if (data.type === '酒精') return '可用「丁二醇」「1,2-己二醇」等多元醇替代抗菌/促渗作用；保湿产品可选无酒精配方。';
  if (data.type === '香精') return '选择标注「无香精(Fragrance-Free)」的产品，或用植物精油调香（但精油也可能致敏）。';
  if (data.type === '清洁表活' && data.level >= 3) return '建议替换为「氨基酸表活（如椰油酰谷氨酸钠）」「APG（癸基葡糖苷）」等温和清洁成分。';
  if (data.type === '果酸' || data.type === '水杨酸') return '敏感肌可改用「乳糖酸」「葡糖酸内酯」等第二代/第三代果酸，或「杏仁酸」等分子量较大的温和酸类。';
  if (data.type === '维A类' && data.level >= 3) return '敏感肌可先用「补骨脂酚(Bakuchiol)」替代，刺激性低且有一定抗老效果；或从低浓度视黄醇衍生物开始。';
  if (data.type === '防腐剂' && data.level >= 4) return '温和替代：「苯氧乙醇」「辛甘醇」「乙基己基甘油」等，或采用无防腐体系（密封包装/多元醇防腐）。';
  if (data.type === '化学防晒' && data.level >= 3) return '敏感肌建议改用「二氧化钛」「氧化锌」等物理防晒剂。';
  if (data.type === '致痘成分' || data.type === '潜在致痘') return '痘肌可选「角鲨烷」「荷荷巴油」等低致痘性油脂替代。';
  return null;
}

// ========== 英文自动翻译 ==========
function translateEnglish(text) {
  const items = text.split(/[，,、；;|\\\/\n]+/);
  const translated = [];
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;

    // 如果是中文或数字（没有英文字母），直接保留，不做翻译
    const hasEnglish = /[a-zA-Z]/.test(t);
    if (!hasEnglish) {
      translated.push(t);
      continue;
    }

    const lower = t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    // 清理后是空字符串，说明没有有效英文，直接保留
    if (!lower) {
      translated.push(t);
      continue;
    }

    let found = false;

    // 精确匹配
    if (INGREDIENT_DB[lower]) {
      translated.push(INGREDIENT_DB[lower].name);
      continue;
    }

    // 遍历模糊匹配（避免空字符串匹配所有key）
    for (const [key, data] of Object.entries(INGREDIENT_DB)) {
      if (key && (lower === key || lower.includes(key) || key.includes(lower))) {
        translated.push(data.name);
        found = true;
        break;
      }
    }

    if (!found) translated.push(t);
  }
  return translated.join('、');
}

// ========== 图片裁剪 ==========
let cropImage = null;
let cropCanvas = null;
let cropCtx = null;
let cropBoxEl = null;
let cropWrapperEl = null;
let cropOverlayEl = null;

let cropState = { dragging: false, resizing: false, startX: 0, startY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0, handle: null };

function initCrop(imageFile) {
  const reader = new FileReader();
  reader.onload = function(e) {
    cropImage = new Image();
    cropImage.onload = function() {
      showCropUI();
    };
    cropImage.src = e.target.result;
  };
  reader.readAsDataURL(imageFile);
}

function showCropUI() {
  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('crop-container').classList.remove('hidden');

  cropCanvas = document.getElementById('crop-canvas');
  cropWrapperEl = document.getElementById('crop-wrapper');
  cropBoxEl = document.getElementById('crop-box');
  cropOverlayEl = document.getElementById('crop-overlay');
  cropCtx = cropCanvas.getContext('2d');

  // 关键修复：保持较高的像素分辨率用于OCR识别
  // CSS显示宽度100%，但实际canvas像素宽度保持清晰
  const displayW = cropWrapperEl.clientWidth;
  const maxPixelW = 1200; // 最大像素宽度，保证文字清晰
  const pixelScale = Math.min(1, maxPixelW / cropImage.width);
  const pixelW = Math.round(cropImage.width * pixelScale);
  const pixelH = Math.round(cropImage.height * pixelScale);

  cropCanvas.width = pixelW;
  cropCanvas.height = pixelH;
  cropCanvas.style.width = displayW + 'px';
  cropCanvas.style.height = 'auto';
  cropCtx.drawImage(cropImage, 0, 0, pixelW, pixelH);

  // 记录CSS显示尺寸和实际像素尺寸的比例，confirmCrop时转换坐标
  cropCanvas.dataset.scaleX = pixelW / displayW;
  cropCanvas.dataset.scaleY = pixelH / (cropCanvas.offsetHeight || pixelH);

  // 默认裁剪框：中心60%区域（基于CSS显示尺寸）
  cropState.boxW = Math.round(displayW * 0.6);
  cropState.boxH = Math.round((cropCanvas.offsetHeight || pixelH) * 0.4);
  cropState.boxX = Math.round((displayW - cropState.boxW) / 2);
  cropState.boxY = Math.round(((cropCanvas.offsetHeight || pixelH) - cropState.boxH) / 2);

  updateCropBox();
  bindCropEvents();
}

function updateCropBox() {
  cropBoxEl.style.left = cropState.boxX + 'px';
  cropBoxEl.style.top = cropState.boxY + 'px';
  cropBoxEl.style.width = cropState.boxW + 'px';
  cropBoxEl.style.height = cropState.boxH + 'px';
}

function bindCropEvents() {
  // 鼠标事件
  cropBoxEl.addEventListener('mousedown', onCropMouseDown);
  document.addEventListener('mousemove', onCropMouseMove);
  document.addEventListener('mouseup', onCropMouseUp);
  // 触摸事件
  cropBoxEl.addEventListener('touchstart', onCropTouchStart, { passive: false });
  document.addEventListener('touchmove', onCropTouchMove, { passive: false });
  document.addEventListener('touchend', onCropMouseUp);
}

function onCropMouseDown(e) {
  if (e.target.classList.contains('crop-handle')) {
    cropState.resizing = true;
    cropState.handle = e.target.classList.contains('nw') ? 'nw' :
                       e.target.classList.contains('ne') ? 'ne' :
                       e.target.classList.contains('sw') ? 'sw' : 'se';
  } else {
    cropState.dragging = true;
  }
  cropState.startX = e.clientX;
  cropState.startY = e.clientY;
  e.preventDefault();
}

function onCropTouchStart(e) {
  if (e.target.classList.contains('crop-handle')) {
    cropState.resizing = true;
    cropState.handle = e.target.classList.contains('nw') ? 'nw' :
                       e.target.classList.contains('ne') ? 'ne' :
                       e.target.classList.contains('sw') ? 'sw' : 'se';
  } else {
    cropState.dragging = true;
  }
  cropState.startX = e.touches[0].clientX;
  cropState.startY = e.touches[0].clientY;
  e.preventDefault();
}

function onCropMouseMove(e) {
  if (!cropState.dragging && !cropState.resizing) return;
  const clientX = e.clientX;
  const clientY = e.clientY;
  updateCropPosition(clientX, clientY);
}

function onCropTouchMove(e) {
  if (!cropState.dragging && !cropState.resizing) return;
  const clientX = e.touches[0].clientX;
  const clientY = e.touches[0].clientY;
  updateCropPosition(clientX, clientY);
  e.preventDefault();
}

function updateCropPosition(clientX, clientY) {
  const dx = clientX - cropState.startX;
  const dy = clientY - cropState.startY;

  if (cropState.dragging) {
    let nx = cropState.boxX + dx;
    let ny = cropState.boxY + dy;
    nx = Math.max(0, Math.min(cropCanvas.width - cropState.boxW, nx));
    ny = Math.max(0, Math.min(cropCanvas.height - cropState.boxH, ny));
    cropState.boxX = nx;
    cropState.boxY = ny;
    cropState.startX = clientX;
    cropState.startY = clientY;
    updateCropBox();
  } else if (cropState.resizing) {
    const minSize = 40;
    let nx = cropState.boxX, ny = cropState.boxY, nw = cropState.boxW, nh = cropState.boxH;
    switch (cropState.handle) {
      case 'se': nw += dx; nh += dy; break;
      case 'sw': nx += dx; nw -= dx; nh += dy; break;
      case 'ne': nw += dx; ny += dy; nh -= dy; break;
      case 'nw': nx += dx; nw -= dx; ny += dy; nh -= dy; break;
    }
    if (nw >= minSize && nh >= minSize && nx >= 0 && ny >= 0 && nx + nw <= cropCanvas.width && ny + nh <= cropCanvas.height) {
      cropState.boxX = nx; cropState.boxY = ny; cropState.boxW = nw; cropState.boxH = nh;
      cropState.startX = clientX; cropState.startY = clientY;
      updateCropBox();
    }
  }
}

function onCropMouseUp() {
  cropState.dragging = false;
  cropState.resizing = false;
  cropState.handle = null;
}

function resetCrop() {
  if (!cropCanvas) return;
  cropState.boxW = Math.round(cropCanvas.width * 0.6);
  cropState.boxH = Math.round(cropCanvas.height * 0.4);
  cropState.boxX = Math.round((cropCanvas.width - cropState.boxW) / 2);
  cropState.boxY = Math.round((cropCanvas.height - cropState.boxH) / 2);
  updateCropBox();
}

function cancelCrop() {
  document.getElementById('crop-container').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('file-input').value = '';
}

// ========== 图像预处理 ==========
// 百度OCR模型本身很强大，不需要前端做复杂预处理
// 只做：裁剪 + 轻微对比度增强（保留原图色彩，不二值化）
function preprocessImage(srcCanvas, sx, sy, sw, sh) {
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(sw);
  tmp.height = Math.round(sh);
  const ctx = tmp.getContext('2d');

  // 关闭图像平滑，保持文字边缘锐利
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);

  // 轻微对比度增强（保留彩色信息）
  const imgData = ctx.getImageData(0, 0, tmp.width, tmp.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 128));     // R
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.2 + 128)); // G
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.2 + 128)); // B
    // 不修改Alpha通道，不转二值化
  }
  ctx.putImageData(imgData, 0, 0);
  return tmp;
}

// ========== OCR 流程 ==========
async function confirmCrop() {
  if (!cropCanvas) return;

  const loading = document.getElementById('ocr-loading');
  const statusEl = document.getElementById('ocr-status');
  loading.classList.remove('hidden');
  statusEl.textContent = '正在预处理图片...';

  try {
    // 1. 将CSS显示坐标转换为canvas实际像素坐标
    const scaleX = parseFloat(cropCanvas.dataset.scaleX) || 1;
    const scaleY = parseFloat(cropCanvas.dataset.scaleY) || 1;
    const sx = Math.round(cropState.boxX * scaleX);
    const sy = Math.round(cropState.boxY * scaleY);
    const sw = Math.round(cropState.boxW * scaleX);
    const sh = Math.round(cropState.boxH * scaleY);

    console.log('[调试] 裁剪坐标(CSS):', cropState.boxX, cropState.boxY, cropState.boxW, cropState.boxH);
    console.log('[调试] 裁剪坐标(像素):', sx, sy, sw, sh);
    console.log('[调试] canvas尺寸:', cropCanvas.width, cropCanvas.height, 'scale:', scaleX, scaleY);

    // 2. 预处理后转为base64
    statusEl.textContent = '正在优化图片...';
    const processed = preprocessImage(cropCanvas, sx, sy, sw, sh);

    // 调试：显示将要识别的图片（可选，帮助排查）
    console.log('[调试] 待识别图片尺寸:', processed.width, processed.height);

    const imageBase64 = processed.toDataURL('image/jpeg', 0.9);
    console.log('[前端调试] base64长度:', imageBase64.length, '前缀:', imageBase64.substring(0, 50));

    // 检查base64是否有效
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error('图片处理失败，请尝试重新上传');
    }

    // 3. 调用百度OCR代理API
    statusEl.textContent = '正在调用百度OCR识别...';
    let response;
    try {
      response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });
    } catch (fetchErr) {
      throw new Error('无法连接到本地服务器，请确认已运行 node server.js 并保持窗口打开');
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonErr) {
      throw new Error('服务器返回数据异常，请查看终端日志');
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || `服务器错误 (${response.status})`);
    }

    // 4. 拼接百度OCR结果
    let rawText = '';
    if (result.data && result.data.words_result) {
      rawText = result.data.words_result.map(item => item.words).join('\n');
    }
    console.log('百度OCR原始结果:', rawText);

    if (!rawText || rawText.trim().length < 3) {
      throw new Error('未能从图片中识别出文字');
    }

    // 5. 英文自动翻译
    statusEl.textContent = '正在翻译英文成分...';
    const translated = translateEnglish(rawText);
    console.log('翻译后:', translated);

    // 6. 只提取成分
    const extracted = extractIngredientsFromOCR(translated || rawText);
    console.log('提取后:', extracted);

    loading.classList.add('hidden');
    document.getElementById('crop-container').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');

    // 调试信息走 console，不打扰用户
    console.log('[OCR调试] 原始文本前200字:', (translated || rawText).substring(0, 200));

    if (!extracted || extracted.length < 5) {
      document.getElementById('ingredient-input').value = translated || rawText;
      showToast('未能有效提取成分，已填入原始文本，请手动清理', 'warn');
    } else {
      document.getElementById('ingredient-input').value = extracted;
      showToast(`识别完成！已提取 ${extracted.split('、').length} 个成分`, 'success');
    }
    goPage('analyze');
    document.getElementById('file-input').value = '';
  } catch (err) {
    loading.classList.add('hidden');
    console.error(err);
    showToast('图片识别失败，建议手动输入', 'error');
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  initCrop(file);
}

// 拖拽上传（全局阻止默认行为 + uploadZone绑定）
document.addEventListener('dragover', e => { e.preventDefault(); });
document.addEventListener('drop', e => { e.preventDefault(); });

const uploadZone = document.getElementById('upload-zone');
if (uploadZone) {
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      console.log('[拖拽] 收到文件:', files[0].name);
      initCrop(files[0]);
    }
  });
}

// ========== 肤质档案 ==========
function saveProfile() {
  const skinTypes = Array.from(document.querySelectorAll('#skin-types .tag.selected')).map(t => t.dataset.value);
  const allergies = Array.from(document.querySelectorAll('#allergy-list .tag.danger-selected')).map(t => t.dataset.value);
  const specialStatus = Array.from(document.querySelectorAll('#special-status .tag.selected')).map(t => t.dataset.value);
  profile = { skinTypes, allergies, specialStatus };
  localStorage.setItem('skincare_profile', JSON.stringify(profile));
  document.getElementById('profile-saved').style.display = 'block';
  setTimeout(() => { document.getElementById('profile-saved').style.display = 'none'; }, 2500);
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem('skincare_profile')) || {}; }
  catch { return {}; }
}

function renderProfile() {
  document.querySelectorAll('.tag').forEach(t => t.classList.remove('selected', 'danger-selected'));
  if (profile.skinTypes) profile.skinTypes.forEach(v => {
    const el = document.querySelector(`#skin-types .tag[data-value="${v}"]`);
    if (el) el.classList.add('selected');
  });
  if (profile.allergies) profile.allergies.forEach(v => {
    const el = document.querySelector(`#allergy-list .tag[data-value="${v}"]`);
    if (el) el.classList.add('danger-selected');
  });
  if (profile.specialStatus) profile.specialStatus.forEach(v => {
    const el = document.querySelector(`#special-status .tag[data-value="${v}"]`);
    if (el) el.classList.add('selected');
  });
}

document.querySelectorAll('.tag-list').forEach(list => {
  list.addEventListener('click', e => {
    if (e.target.classList.contains('tag')) {
      if (list.id === 'allergy-list') e.target.classList.toggle('danger-selected');
      else e.target.classList.toggle('selected');
    }
  });
});

function addCustomAllergy() {
  const input = document.getElementById('custom-allergy');
  const val = input.value.trim();
  if (!val) return;
  const list = document.getElementById('allergy-list');
  const tag = document.createElement('span');
  tag.className = 'tag danger-selected';
  tag.dataset.value = val;
  tag.textContent = val;
  list.appendChild(tag);
  input.value = '';
}

// ========== 历史记录 ==========
function saveToHistory() {
  if (!currentResult) return;
  const name = prompt('给这个产品起个名字吧（方便日后查找）:', currentResult.productName);
  if (name === null) return;
  currentResult.productName = name.trim() || '未命名产品';
  historyData.unshift(currentResult);
  if (historyData.length > 50) historyData = historyData.slice(0, 50);
  localStorage.setItem('skincare_history', JSON.stringify(historyData));
  showToast('已保存到历史记录', 'success');
  fireConfetti(15);
  showCelebrateBadge('保存成功 📚');
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('skincare_history')) || []; }
  catch { return []; }
}

function renderHistory() {
  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  const clearBtn = document.getElementById('clear-history');
  if (historyData.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  clearBtn.classList.remove('hidden');
  listEl.innerHTML = historyData.map(item => {
    const scoreClass = item.score >= 75 ? 'score-excellent' : item.score >= 60 ? 'score-warning' : 'score-danger';
    const riskTags = [];
    if (item.riskCount.banned > 0) riskTags.push(`⛔ ${item.riskCount.banned}`);
    if (item.riskCount.high > 0) riskTags.push(`🔴 ${item.riskCount.high}`);
    if (item.riskCount.medium > 0) riskTags.push(`🟠 ${item.riskCount.medium}`);
    return `<div class="history-item" onclick="viewHistoryItem(${item.id})">
      <div class="history-score ${scoreClass}">${item.score}</div>
      <div class="history-info">
        <div class="history-name">${escapeHtml(item.productName)}</div>
        <div class="history-date">${item.date}</div>
        ${riskTags.length > 0 ? `<div class="history-tags">${riskTags.map(t => `<span class="history-tag">${t}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function viewHistoryItem(id) {
  const item = historyData.find(h => h.id === id);
  if (!item) return;
  currentResult = item;
  renderResult(item);
  goPage('result');
}

function clearHistory() {
  showConfirmSheet('清空历史记录', '确定要清空所有历史记录吗？此操作不可撤销。', () => {
    historyData = [];
    localStorage.removeItem('skincare_history');
    renderHistory();
    showToast('已清空历史记录', 'success');
  });
}

// ========== 快速体验：示例成分 ==========
const DEMO_INGREDIENTS = '水、甘油、丁二醇、乙醇、香精、苯氧乙醇、卡波姆、三乙醇胺、水杨酸、生育酚乙酸酯、EDTA二钠、透明质酸钠';

function loadDemo() {
  const input = document.getElementById('ingredient-input');
  input.value = DEMO_INGREDIENTS;
  input.focus();
  showToast('已填入示例成分，点击分析查看报告', 'success');
  // 高亮滚动到输入区
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.animate([
    { boxShadow: '0 0 0 0 rgba(59,130,246,0.4)' },
    { boxShadow: '0 0 0 8px rgba(59,130,246,0)' }
  ], { duration: 800 });
}

// ========== 分享报告 ==========
function shareReport() {
  if (!currentResult) return;
  const { score, comment, productName, riskCount } = currentResult;
  const total = Object.values(riskCount).reduce((a, b) => a + b, 0);
  const risky = (riskCount.medium || 0) + (riskCount.high || 0) + (riskCount.banned || 0);
  const text = `【安肌成分检测报告】\n产品：${productName}\n安全评分：${score}分 · ${comment.text}\n成分总数：${total}｜风险成分：${risky}\n\n来安肌测测你的护肤品是否安全 👉 ${location.origin}`;

  if (navigator.share) {
    navigator.share({
      title: '安肌成分检测报告',
      text: text,
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('报告内容已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败，请手动截图分享', 'warn');
    });
  }
}

// ========== 新手引导 ==========
const ONBOARDING_KEY = 'skincare_onboarding_v4';
const ONBOARDING_STEPS = [
  {
    icon: '🌿',
    title: '欢迎来到安肌',
    desc: '安肌是你的敏感肌成分检测助手。拍照或粘贴成分表，就能快速生成安全分析报告。'
  },
  {
    icon: '📷',
    title: '拍照识别成分',
    desc: '上传产品成分表照片，框选成分区域，百度 OCR 会自动识别并提取成分名称。'
  },
  {
    icon: '👤',
    title: '建立肤质档案',
    desc: '在「档案」页选择你的肤质和过敏成分，分析结果会更贴合你的实际情况。'
  },
  {
    icon: '📊',
    title: '查看风险报告',
    desc: '获得安全评分、风险统计、成分冲突提醒，还能保存历史记录方便对比。'
  }
];

function showOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return;
  let step = 0;
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-illustration">${ONBOARDING_STEPS[0].icon}</div>
      <h3>${ONBOARDING_STEPS[0].title}</h3>
      <p>${ONBOARDING_STEPS[0].desc}</p>
      <div class="onboarding-steps">
        ${ONBOARDING_STEPS.map((_, i) => `<div class="onboarding-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
      </div>
      <button class="btn btn-primary" id="onboarding-next">下一步</button>
    </div>`;
  document.body.appendChild(overlay);

  const update = () => {
    const s = ONBOARDING_STEPS[step];
    overlay.querySelector('.onboarding-illustration').textContent = s.icon;
    overlay.querySelector('h3').textContent = s.title;
    overlay.querySelector('p').textContent = s.desc;
    overlay.querySelectorAll('.onboarding-dot').forEach((d, i) => d.classList.toggle('active', i === step));
    const btn = overlay.querySelector('#onboarding-next');
    btn.textContent = step === ONBOARDING_STEPS.length - 1 ? '开始使用' : '下一步';
  };

  overlay.querySelector('#onboarding-next').addEventListener('click', () => {
    step++;
    if (step >= ONBOARDING_STEPS.length) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    } else {
      update();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  });
}

// ========== 全局交互增强 ==========

// 每日小贴士
const DAILY_TIPS = [
  { icon: '💡', title: '每日小贴士', text: '敏感肌建议优先选择无香精、无酒精的护肤品' },
  { icon: '🌿', title: '成分小知识', text: '神经酰胺和角鲨烷是修护屏障的经典组合' },
  { icon: '⚠️', title: '避雷提醒', text: '敏感肌看到「变性酒精」「香精」要格外谨慎' },
  { icon: '🔆', title: '护肤建议', text: '早 C 晚 A 虽火，但敏感肌请先建立耐受' },
  { icon: '🧴', title: '洁面选择', text: '氨基酸或 APG 洁面比皂基更适合敏感肌' },
];
let currentTip = 0;
let tipTimer = null;

function showTip(index) {
  const tip = DAILY_TIPS[index];
  const textEl = document.getElementById('tip-text');
  if (!textEl) return;
  textEl.style.opacity = '0';
  setTimeout(() => {
    textEl.textContent = tip.text;
    textEl.style.opacity = '1';
  }, 200);

  document.querySelectorAll('#tip-dots .tip-dot').forEach((d, i) => {
    d.classList.toggle('active', i === index);
  });
}

function nextTip() {
  currentTip = (currentTip + 1) % DAILY_TIPS.length;
  showTip(currentTip);
  resetTipTimer();
}

function resetTipTimer() {
  if (tipTimer) clearInterval(tipTimer);
  tipTimer = setInterval(() => {
    currentTip = (currentTip + 1) % DAILY_TIPS.length;
    showTip(currentTip);
  }, 5000);
}

// 滚动进度条 + 返回顶部
function initScrollEffects() {
  const progress = document.getElementById('scroll-progress');
  const backToTop = document.getElementById('back-to-top');
  if (!progress || !backToTop) return;

  let raf = null;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progress.style.width = percent + '%';
      backToTop.classList.toggle('show', scrollTop > 300);
      raf = null;
    });
  }, { passive: true });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 成分风险筛选
function filterIngredients(level) {
  document.querySelectorAll('#ingredient-filter .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === level);
  });

  const items = document.querySelectorAll('#ingredient-list .ingredient-item');
  items.forEach(item => {
    const itemLevel = item.dataset.level;
    if (level === 'all' || itemLevel === level) {
      item.classList.remove('hidden-item');
      item.style.animation = 'none';
      item.offsetHeight; // trigger reflow
      item.style.animation = 'pageIn 0.35s ease';
    } else {
      item.classList.add('hidden-item');
    }
  });
}

// Confetti 撒花
function fireConfetti(count = 30) {
  const colors = ['#C4A77D', '#A67B5B', '#8B9A7C', '#D4A373', '#C76B6B', '#F5E6D3'];
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    confetti.style.width = (6 + Math.random() * 8) + 'px';
    confetti.style.height = (6 + Math.random() * 8) + 'px';
    confetti.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3500);
  }
}

function showCelebrateBadge(text) {
  const badge = document.createElement('div');
  badge.className = 'celebrate-badge';
  badge.textContent = text;
  document.body.appendChild(badge);
  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => badge.remove(), 400);
  }, 1800);
}

// 手势滑动切换页面
function initSwipe() {
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    const dt = Date.now() - startTime;

    if (dt > 300 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 1.2) return;

    const pages = ['analyze', 'profile', 'history'];
    const current = document.querySelector('.page.active');
    if (!current) return;
    const currentId = current.id.replace('page-', '');
    const idx = pages.indexOf(currentId);
    if (idx === -1) return;

    if (dx < 0 && idx < pages.length - 1) {
      goPage(pages[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      goPage(pages[idx - 1]);
    }
  }, { passive: true });
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  renderProfile();
  showOnboarding();
  initScrollEffects();
  resetTipTimer();
  initSwipe();
});
