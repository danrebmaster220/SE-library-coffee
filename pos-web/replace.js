import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    let fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(fullPath));
    } else { 
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('src');

files.forEach(f => {
  if (f.endsWith('.jsx')) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // Replace modal-header backgroundColor inline styles
    content = content.replace(/backgroundColor:\s*'#fcfcfc'/g, "backgroundColor: '#6b4423eb'");
    content = content.replace(/backgroundColor:\s*\"#fcfcfc\"/g, "backgroundColor: '#6b4423eb'");
    content = content.replace(/borderBottom:\s*'1px solid #eee'/g, "borderBottom: '1px solid #6b4423eb'");
    
    // Replace modal-title colors
    content = content.replace(/className=\"modal-title\" style=\{\{\s*color:\s*'#333'\s*\}\}/g, "className=\"modal-title\" style={{ color: '#fff' }}");
    
    // Replace modal-close colors
    content = content.replace(/className=\"modal-close\"\s+onClick=\{[^}]+\}\s+style=\{\{.*?color:\s*'#666'.*?\}\}/g, (match) => {
      return match.replace(/'#666'/, "'#fff'");
    });
    
    // Also replace color: '#333' for icon buttons containing "modal-close" 
    content = content.replace(/className=\"modal-close\"\s+onClick=\{[^}]+\}\s+style=\{\{.*?color:\s*'#333'.*?\}\}/g, (match) => {
      return match.replace(/'#333'/, "'#fff'");
    });
    
    // Also handling the Back button in VoidTransactionModal which has color: '#666'
    content = content.replace(/style=\{\{\s*position:\s*'absolute',\s*left:\s*'15px',\s*color:\s*'#666'\s*\}\}/g, "style={{ position: 'absolute', left: '15px', color: '#fff' }}");
    content = content.replace(/style=\{\{\s*color:\s*'#666',\s*position:\s*'absolute',\s*right:\s*'15px'\s*\}\}/g, "style={{ color: '#fff', position: 'absolute', right: '15px' }}");
    
    
    if (content !== original) {
      fs.writeFileSync(f, content);
      console.log('Updated JSX:', f);
    }
  }
  
  if (f.endsWith('.css')) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // Remove padding: 30px from modal-content inside global.css
    if (f.includes('global.css')) {
      content = content.replace(/\.modal-content\s*\{([^}]*?)padding:\s*30px;([^}]*?)\}/g, ".modal-content {$1$2}");
    }

    // Replace gradient backgrounds on buttons with #6b4423eb globally
    content = content.replace(/background:\s*linear-gradient\([^)]*\);/g, "background: #6b4423eb;");
    
    // Inject hover styles for global buttons if not already present or replace them
    content = content.replace(/\.btn-primary:hover\s*\{([^}]*)\}/g, ".btn-primary:hover {\n  background: #8b5a2b !important;$1}");
    content = content.replace(/\.btn-add:hover\s*\{([^}]*)\}/g, ".btn-add:hover {\n  background: #8b5a2b !important;$1}");
    content = content.replace(/\.btn-confirm:hover\s*\{([^}]*)\}/g, ".btn-confirm:hover {\n  background: #8b5a2b !important;$1}");
    content = content.replace(/\.btn-action:hover\s*\{([^}]*)\}/g, ".btn-action:hover {\n  background: #8b5a2b !important;$1}");
    
    if (content !== original) {
      fs.writeFileSync(f, content);
      console.log('Updated CSS:', f);
    }
  }
});
