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
const regexBoundaryCheck = (code) => {
  const regex = /\/(?:\\\/|[^\/\n])*\/[gimuy]*/g;
  let lastIndex = 0;
  const segments = [];

  let match;
  while ((match = regex.exec(code))  !== null) {
    // 保存非正则区域
    segments.push({  type: 'text', content: code.slice(lastIndex,  match.index)  });
    // 保存正则区域（不处理）
    segments.push({  type: 'regex', content: match[0] });
    lastIndex = match.index  + match[0].length;
  }
  segments.push({  type: 'text', content: code.slice(lastIndex)  });

  return segments;
};

const fixUnicodeEscape = (code) => {
  const segments = regexBoundaryCheck(code);

  return segments.map(segment  => {
    if (segment.type  === 'regex') return segment.content;

    return segment.content.replace(/\\u([0-9a-fA-F]{4})/g,  (_, hex) => {
      return String.fromCharCode(parseInt(hex,  16));
    });
  }).join('');
};

const validateDynamicRegex = (code) => {
  return code.replace(/new\s+RegExp\((['"])(.+?)\1/g,  (match, quote, pattern) => {
    try {
      new RegExp(pattern); // 语法校验
      return match;
    } catch (e) {
      console.warn(`[WARN]  动态正则语法错误: ${pattern}`);
      return `new RegExp(${quote}${quote}/* INVALID_REGEX: ${pattern} */)`;
    }
  });
};

// 使用链式处理
const finalCode = validateDynamicRegex(fixUnicodeEscape(code));

// 将读取到的 code 字符串传递给 Babel parser 进行解析
const ast = parser.parse(finalCode);
//-------------------------CODE-------------------------------

//--------------通用模块引入---------------
//示例：selector.selectgeneralmodule(0).asicll_unicord_deob(ast)


//selector.selectgeneralmodule(0).asicll_unicord_deob(ast)
//  selector.selectgeneralmodule(1).CondExp(ast,1)
//  selector.selectgeneralmodule(3).IFtoSwitch(ast)
//  selector.selectgeneralmodule(4).MergeSwitch(ast)
 selector.selectgeneralmodule(5).MergeOne(ast)

//--------------个性模块引入---------------
//示例：selector.selectpersionalmodule(0).Obdeconfuse(ast,0);

//selector.selectpersionalmodule(0).decrypt(ast);

//-----------------------------------------














//----------------------------OUTPUT------------------------------
// 生成修改后的代码
const result = generate(ast);
// 将修改后的代码写入到 result.js 文件
fs.writeFile('./InputAndOutput/output.js', result.code, 'utf8', (err) => {
    if (err) {
        console.error('写入文件失败:', err);
        return;
    }
    console.log('修改后的代码已成功保存到输出文件中');
});
