const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const configFile = path.join(dataDir, 'custom-categories.json');

function loadCategories() {
  if (!fs.existsSync(configFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  } catch {
    return [];
  }
}

function slugify(name) {
  let id = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!id) id = 'cat-' + Date.now();
  return id;
}

function uniqueId(baseId, categories) {
  const ids = new Set(categories.map((c) => c.id));
  if (!ids.has(baseId)) return baseId;
  let n = 2;
  while (ids.has(`${baseId}-${n}`)) n += 1;
  return `${baseId}-${n}`;
}

/**
 * @param {string} name
 * @param {string[]} keywordList
 */
function addCategory(name, keywordList) {
  if (!name || !keywordList || keywordList.length === 0) {
    const err = new Error('请填写分类名称和关键词');
    err.statusCode = 400;
    throw err;
  }

  const categories = loadCategories();
  const baseId = slugify(name);
  const id = uniqueId(baseId, categories);

  const entry = { id, name: name.trim(), keywords: keywordList };
  categories.push(entry);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(categories, null, 2));
  return entry;
}

function deleteCategory(id) {
  if (!id) {
    const err = new Error('缺少分类 ID');
    err.statusCode = 400;
    throw err;
  }

  const categories = loadCategories();
  const idx = categories.findIndex(c => c.id === id);
  if (idx < 0) {
    const err = new Error('分类不存在');
    err.statusCode = 404;
    throw err;
  }

  categories.splice(idx, 1);
  fs.writeFileSync(configFile, JSON.stringify(categories, null, 2));

  // 同步清理 custom-data.json
  const customDataFile = path.join(dataDir, 'custom-data.json');
  try {
    if (fs.existsSync(customDataFile)) {
      let list = JSON.parse(fs.readFileSync(customDataFile, 'utf-8'));
      list = list.filter(c => c.id !== id);
      fs.writeFileSync(customDataFile, JSON.stringify(list, null, 2));
    }
  } catch {}

  // 同步清理今日的带日期文件
  const today = new Date().toISOString().slice(0, 10);
  const datedFile = path.join(dataDir, 'custom-data-' + today + '.json');
  try {
    if (fs.existsSync(datedFile)) {
      let list = JSON.parse(fs.readFileSync(datedFile, 'utf-8'));
      list = list.filter(c => c.id !== id);
      fs.writeFileSync(datedFile, JSON.stringify(list, null, 2));
    }
  } catch {}

  return { id, deleted: true };
}

module.exports = { loadCategories, addCategory, deleteCategory, configFile };
