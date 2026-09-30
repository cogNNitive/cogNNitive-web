const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE_PATH = path.join(__dirname, '..', 'config.json');

function getDefaultPath() {
  const config = getConfig();
  if (config.defaultPath) {
    return config.defaultPath;
  }
  // Default to User's Documents/traNNsform
  return path.join(os.homedir(), 'Documents', 'traNNsform');
}

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading config file, using defaults:', err.message);
  }
  return {};
}

function saveConfig(newConfig) {
  try {
    const currentConfig = getConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updatedConfig, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving config file:', err.message);
    return false;
  }
}

module.exports = {
  getDefaultPath,
  getConfig,
  saveConfig
};
