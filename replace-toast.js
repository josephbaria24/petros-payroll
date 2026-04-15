const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(path.join(dirPath));
      }
    }
  });
}

function replaceImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Perform replacement
    let modified = false;
    if (content.includes('import { toast } from "sonner"')) {
      content = content.replace(/import \{ toast \} from "sonner"/g, 'import { toast } from "@/lib/toast"');
      modified = true;
    }
    
    if (content.includes("import { toast } from 'sonner'")) {
       content = content.replace(/import \{ toast \} from 'sonner'/g, 'import { toast } from "@/lib/toast"');
       modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated: ' + filePath);
    }
  } catch (err) {
    console.error('Failed to process', filePath, err);
  }
}

const targetDirs = [
  path.join(__dirname, 'app'),
  path.join(__dirname, 'components')
];

targetDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkDir(dir, replaceImports);
  }
});
