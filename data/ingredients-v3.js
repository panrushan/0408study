// 内置敏感肌风险成分数据库 (方案C：可扩展接口)
// 等级: 1=安全 2=低敏 3=中风险 4=高风险 5=禁用
const INGREDIENT_DB = {
  // 酒精类
  "alcohol": { name: "乙醇/酒精", level: 4, type: "酒精", reason: "长期使用会破坏皮肤屏障，敏感肌慎用" },
  "sd alcohol": { name: "SD酒精", level: 4, type: "酒精", reason: "刺激性较强，易引发干燥泛红" },
  "denatured alcohol": { name: "变性酒精", level: 4, type: "酒精", reason: "高挥发性，刺激皮肤" },
  
  // 香精类
  "fragrance": { name: "香精", level: 3, type: "香精", reason: "常见过敏原，敏感肌建议避开" },
  "parfum": { name: "香精(Parfum)", level: 3, type: "香精", reason: "成分复杂，致敏率高" },
  "perfume": { name: "香水/香精", level: 3, type: "香精", reason: "含多种潜在致敏物质" },
  
  // 防腐剂类
  "methylisothiazolinone": { name: "甲基异噻唑啉酮(MI)", level: 5, type: "防腐剂", reason: "高致敏性，欧盟已限制使用" },
  "methylchloroisothiazolinone": { name: "甲基氯异噻唑啉酮(MCI)", level: 5, type: "防腐剂", reason: "与MI类似，高致敏风险" },
  "mit": { name: "MIT", level: 5, type: "防腐剂", reason: "强效防腐剂，极易致敏" },
  "cmc": { name: "CMCI", level: 5, type: "防腐剂", reason: "高致敏性防腐剂" },
  "formaldehyde": { name: "甲醛", level: 5, type: "防腐剂", reason: "致癌物，严禁用于化妆品" },
  "formaldehyde releasers": { name: "甲醛释放体", level: 4, type: "防腐剂", reason: "缓慢释放甲醛，长期刺激" },
  "dmdm hydantoin": { name: "DMDM乙内酰脲", level: 4, type: "防腐剂", reason: "甲醛释放体，致敏致癌" },
  "imidazolidinyl urea": { name: "咪唑烷基脲", level: 4, type: "防腐剂", reason: "甲醛释放体" },
  "diazolidinyl urea": { name: "双咪唑烷基脲", level: 4, type: "防腐剂", reason: "甲醛释放体" },
  "quaternium-15": { name: "季铵盐-15", level: 5, type: "防腐剂", reason: "甲醛释放体，高致敏" },
  "parabens": { name: "parabens（对羟基苯甲酸酯）", level: 3, type: "防腐剂", reason: "类雌激素作用，争议较大" },
  "methylparaben": { name: "羟苯甲酯", level: 3, type: "防腐剂", reason: "paraben类防腐剂" },
  "propylparaben": { name: "羟苯丙酯", level: 3, type: "防腐剂", reason: "paraben类防腐剂" },
  "butylparaben": { name: "羟苯丁酯", level: 3, type: "防腐剂", reason: "paraben类防腐剂" },
  "ethylparaben": { name: "羟苯乙酯", level: 3, type: "防腐剂", reason: "paraben类防腐剂" },
  "isobutylparaben": { name: "羟苯异丁酯", level: 4, type: "防腐剂", reason: "paraben类，风险较高" },
  "isopropylparaben": { name: "羟苯异丙酯", level: 4, type: "防腐剂", reason: "paraben类，风险较高" },
  "phenoxyethanol": { name: "苯氧乙醇", level: 2, type: "防腐剂", reason: "相对温和，高浓度可能刺激" },
  
  // 皂基/SLS/SLES
  "sodium lauryl sulfate": { name: "月桂醇硫酸酯钠(SLS)", level: 4, type: "清洁表活", reason: "脱脂力过强，破坏屏障" },
  "sls": { name: "SLS", level: 4, type: "清洁表活", reason: "强效去脂，易致干敏" },
  "sodium laureth sulfate": { name: "月桂醇聚醚硫酸酯钠(SLES)", level: 3, type: "清洁表活", reason: "刺激性较SLS低，但仍需注意" },
  "sles": { name: "SLES", level: 3, type: "清洁表活", reason: "可能含有二噁烷残留" },
  "ammonium lauryl sulfate": { name: "月桂醇硫酸酯铵(ALS)", level: 3, type: "清洁表活", reason: "刺激性较强" },
  "ammonium laureth sulfate": { name: "月桂醇聚醚硫酸酯铵(ALES)", level: 3, type: "清洁表活", reason: "刺激性较强" },
  
  // 致痘成分
  "isopropyl myristate": { name: "肉豆蔻酸异丙酯(IPM)", level: 3, type: "致痘成分", reason: "致痘指数高，油皮痘肌避开" },
  "isopropyl palmitate": { name: "棕榈酸异丙酯(IPP)", level: 3, type: "致痘成分", reason: "高致痘性" },
  "myristyl myristate": { name: "肉豆蔻酸肉豆蔻酯", level: 3, type: "致痘成分", reason: "致痘指数4-5级" },
  "oleth-3": { name: "油醇聚醚-3", level: 3, type: "致痘成分", reason: "可能堵塞毛孔" },
  "oleyl alcohol": { name: "油醇", level: 3, type: "致痘成分", reason: "对痤疮肌肤不友好" },
  "lanolin": { name: "羊毛脂", level: 2, type: "潜在致痘", reason: "部分提纯不彻底的羊毛脂可能致痘" },
  "lanolin oil": { name: "羊毛脂油", level: 2, type: "潜在致痘", reason: "敏感肌可能不适" },
  "cocoa butter": { name: "可可脂", level: 3, type: "致痘成分", reason: "高致痘性，易堵塞毛孔" },
  "coconut oil": { name: "椰子油", level: 2, type: "潜在致痘", reason: "闭塞性强，痘肌慎用" },
  
  // 酸类（需根据肤质判断）
  "glycolic acid": { name: "甘醇酸/AHA", level: 3, type: "果酸", reason: "去角质能力强，敏感肌需谨慎" },
  "lactic acid": { name: "乳酸", level: 2, type: "果酸", reason: "较温和的AHA，但仍需建立耐受" },
  "salicylic acid": { name: "水杨酸/BHA", level: 3, type: "水杨酸", reason: "渗透性强，干敏肌慎用" },
  "citric acid": { name: "柠檬酸", level: 2, type: "果酸", reason: "pH调节/去角质，敏感肌注意浓度" },
  "tartaric acid": { name: "酒石酸", level: 2, type: "果酸", reason: "果酸类，注意浓度" },
  "malic acid": { name: "苹果酸", level: 2, type: "果酸", reason: "果酸类，注意浓度" },
  "mandelic acid": { name: "杏仁酸", level: 2, type: "果酸", reason: "分子量大较温和，但仍属酸类" },
  
  // 维A类
  "retinol": { name: "视黄醇/A醇", level: 3, type: "维A类", reason: "强效抗老，需建立耐受，孕期禁用" },
  "retinyl palmitate": { name: "视黄醇棕榈酸酯", level: 2, type: "维A类", reason: "较温和的维A衍生物" },
  "retinal": { name: "视黄醛", level: 3, type: "维A类", reason: "转化效率高，刺激性较强" },
  "tretinoin": { name: "维A酸", level: 4, type: "维A类", reason: "处方药级别，刺激性强，孕妇禁用" },
  "adapalene": { name: "阿达帕林", level: 4, type: "维A类", reason: "第三代维A酸，需医生指导" },
  "tazarotene": { name: "他扎罗汀", level: 4, type: "维A类", reason: "处方维A酸，刺激性强" },
  
  // 其他高风险
  "hydroquinone": { name: "氢醌/对苯二酚", level: 5, type: "美白成分", reason: "潜在致癌性，国内化妆品禁用" },
  "mercury": { name: "汞", level: 5, type: "重金属", reason: "剧毒，严禁添加" },
  "lead": { name: "铅", level: 5, type: "重金属", reason: "神经毒素，严禁添加" },
  "arsenic": { name: "砷", level: 5, type: "重金属", reason: "剧毒，严禁添加" },
  "cadmium": { name: "镉", level: 5, type: "重金属", reason: "剧毒，严禁添加" },
  "mineral oil": { name: "矿物油", level: 2, type: "润肤剂", reason: "纯度低的矿物油可能含杂质" },
  "petrolatum": { name: "凡士林/矿脂", level: 1, type: "封闭剂", reason: "高纯度安全，极敏感肌可用" },
  "vaseline": { name: "凡士林", level: 1, type: "封闭剂", reason: "经典封闭保湿成分" },
  
  // 色素
  "ci 15850": { name: "色素CI 15850", level: 2, type: "色素", reason: "合成色素，敏感肌注意" },
  "ci 19140": { name: "色素CI 19140", level: 2, type: "色素", reason: "合成色素，敏感肌注意" },
  "ci 42090": { name: "色素CI 42090", level: 2, type: "色素", reason: "合成色素，敏感肌注意" },
  "yellow 5": { name: "黄色5号", level: 2, type: "色素", reason: "部分人群可能过敏" },
  "yellow 6": { name: "黄色6号", level: 2, type: "色素", reason: "部分人群可能过敏" },
  "red 33": { name: "红色33号", level: 2, type: "色素", reason: "部分人群可能过敏" },
  
  // 防晒剂
  "oxybenzone": { name: "二苯酮-3", level: 3, type: "化学防晒", reason: "潜在内分泌干扰物，易致敏" },
  "avobenzone": { name: "阿伏苯宗", level: 2, type: "化学防晒", reason: "较安全，但光稳定性差" },
  "octinoxate": { name: "甲氧基肉桂酸乙基己酯", level: 2, type: "化学防晒", reason: "常见防晒剂，部分敏感肌不适" },
  "octocrylene": { name: "奥克立林", level: 2, type: "化学防晒", reason: "较常见，部分敏感肌可能不适" },
  "homosalate": { name: "胡莫柳酯", level: 2, type: "化学防晒", reason: "潜在内分泌干扰争议" },
  "octisalate": { name: "水杨酸乙基己酯", level: 2, type: "化学防晒", reason: "较温和" },
  
  // 硅类
  "dimethicone": { name: "聚二甲基硅氧烷", level: 1, type: "硅类", reason: "安全柔润剂，敏感肌可用" },
  "cyclopentasiloxane": { name: "环五聚二甲基硅氧烷", level: 1, type: "硅类", reason: "挥发性硅油，较安全" },
  "cyclohexasiloxane": { name: "环己硅氧烷", level: 1, type: "硅类", reason: "挥发性硅油" },
  
  // 舒缓成分（安全参考）
  "allantoin": { name: "尿囊素", level: 1, type: "舒缓", reason: "经典舒缓抗炎成分" },
  "bisabolol": { name: "红没药醇", level: 1, type: "舒缓", reason: "抗炎舒缓，适合敏感肌" },
  "centella asiatica": { name: "积雪草", level: 1, type: "舒缓", reason: "修复舒缓，敏感肌友好" },
  "niacinamide": { name: "烟酰胺", level: 1, type: "修护", reason: "修护屏障，控油提亮，温和" },
  "panthenol": { name: "泛醇/B5", level: 1, type: "保湿", reason: "保湿修护，极温和" },
  "ceramide": { name: "神经酰胺", level: 1, type: "修护", reason: "修复屏障核心成分" },
  "hyaluronic acid": { name: "透明质酸/玻尿酸", level: 1, type: "保湿", reason: "经典保湿成分，安全" },
  "squalane": { name: "角鲨烷", level: 1, type: "润肤", reason: "亲肤性极佳，敏感肌适用" },
  "glycerin": { name: "甘油", level: 1, type: "保湿", reason: "最经典的保湿剂，安全" },
  "butylene glycol": { name: "丁二醇", level: 1, type: "保湿", reason: "温和保湿溶剂" },
  "propylen glycol": { name: "丙二醇", level: 2, type: "溶剂", reason: "部分人可能刺激，总体较安全" },
  "urea": { name: "尿素", level: 1, type: "保湿", reason: "天然保湿因子，温和" },
  "aloe vera": { name: "库拉索芦荟", level: 1, type: "舒缓", reason: "舒缓保湿，敏感肌适用" },
  "green tea": { name: "绿茶提取物", level: 1, type: "抗氧化", reason: "抗氧化抗炎，温和" },
  "titanium dioxide": { name: "二氧化钛", level: 1, type: "物理防晒", reason: "物理防晒剂，安全温和" },
  "zinc oxide": { name: "氧化锌", level: 1, type: "物理防晒", reason: "物理防晒剂，安全舒缓" },
};

// 扩展接口：允许动态添加/更新成分
function addIngredient(key, data) {
  INGREDIENT_DB[key.toLowerCase()] = data;
}

function updateIngredient(key, data) {
  const k = key.toLowerCase();
  if (INGREDIENT_DB[k]) {
    INGREDIENT_DB[k] = { ...INGREDIENT_DB[k], ...data };
  }
}

function removeIngredient(key) {
  delete INGREDIENT_DB[key.toLowerCase()];
}
