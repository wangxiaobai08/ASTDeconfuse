//---------------通用脚本引入-------------------------------
const selector = require('./selector.js');
//----------------------------------------------------
const fs = require('fs');
const parser = require("@babel/parser");
const generate = require("@babel/generator").default;

//--------------------------INPUT------------------------------------
// 使用同步的 fs.readFileSync 读取文件内容
const code = fs.readFileSync('./InputAndOutput/input.js', 'utf8');
// 手动处理转义字符
const fixUnicodeEscape = (code) => {
  return code.replace(/\\u([0-9a-fA-F]{4})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  });
};
const transformedCode = fixUnicodeEscape(code);
// 将读取到的 code 字符串传递给 Babel parser 进行解析
const ast = parser.parse(transformedCode);
//-------------------------CODE-------------------------------

//--------------个性化定制引入---------------




//-----------------------------------------

//StringReversion.asicll_unicord_deob(ast)
selector.selectmodule(0).asicll_unicord_deob(ast);





//----------------------------OUTPUT------------------------------
// 生成修改后的代码
const result = generate(ast);
// 将修改后的代码写入到 result.js 文件
fs.writeFile('./InputAndOutput/output.js', result.code, 'utf8', (err) => {
    if (err) {
        console.error('Error writing to file:', err);
        return;
    }
    console.log('Modified code has been saved to output');
});
