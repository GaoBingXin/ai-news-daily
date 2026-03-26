const fs = require('fs');
const path = require('path');

module.exports = async function checkAndCollect() {
  const dataDir = path.join(__dirname, '..', 'data');
  const categoriesFile = path.join(dataDir, 'custom-categories.json');
  const dataFile = path.join(dataDir, 'custom-data.json');
  
  // 读取分类配置
  let categories = [];
  if (fs.existsSync(categoriesFile)) {
    categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf-8'));
  }
  
  // 读取已采集数据
  let customData = [];
  if (fs.existsSync(dataFile)) {
    customData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  }
  
  const existingIds = new Set(customData.map(c => c.id));
  const newCategories = categories.filter(c => !existingIds.has(c.id));
  
  if (newCategories.length > 0) {
    console.log(`发现 ${newCategories.length} 个新分类需要采集`);
    
    // 收集新的分类数据
    for (const cat of newCategories) {
      console.log(`正在采集: ${cat.name}`);
      
      const { collectCustomCategory } = require('./collect-custom.js');
      const result = await collectCustomCategory(cat);
      
      customData = customData.filter(c => c.id !== cat.id);
      customData.push(result);
      
      // 保存
      fs.writeFileSync(dataFile, JSON.stringify(customData, null, 2));
      
      // 生成HTML并部署
      const { generateHTML } = require('./generate-html.js');
      await generateHTML();
      
      console.log(`${cat.name} 采集并部署完成！`);
    }
    
    return { success: true, count: newCategories.length };
  }
  
  return { success: true, count: 0 };
};
