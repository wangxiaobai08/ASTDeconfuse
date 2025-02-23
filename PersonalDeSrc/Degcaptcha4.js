/*
name:极验OB解混淆插件
time:2025.1.3
author: 农民工学编程
 */

// var _ᕺᕾᖁᕷ = _ᖀᖚᕺᖉ.$_CA,
//           _ᖚᕾᖘᖙ = ["$_CGAg"].concat(_ᕺᕾᖁᕷ),
//           _ᕸᕺᕴᖉ = _ᖚᕾᖘᖙ[1];

//var _ᕷᖘᕶᕶ = _ᖀᖚᕺᖉ.$_CA,
const fs = require('fs');  // 引入 fs 模块
const parser = require("@babel/parser");
const generate = require("@babel/generator").default;
const traverse = require("@babel/traverse").default;
const types = require('@babel/types'); // 引入 types


// 用于存储所有的变量名和函数名
//let names = new Set();// 使用 Set 来存储，自动去重

// 判断标识符是否包含英文字符
// function hasEnglishLetters(name) {
//     return /[a-zA-Z]/.test(name);  // 如果包含任何英文字母则返回 true
// }

function decode_replace(path){
    const node=path.node;
    if (node.declarations.length!==3) return;
    try{
        if (!node.declarations[0].init){
            return;
        }
        if (generate(node.declarations[0].init).code!=="_ᖁᕹᖁᕾ.$_CV") return;
    }catch(error){
        console.log("have a mistake"+error);
        console.log(generate(path.getPrevSibling().node).code)
    }

    //console.log("exist _ᖀᖚᕺᖉ.$_CA---------------------------")
    node.declarations=[node.declarations[0],node.declarations[2]]
    node.declarations[1].init=node.declarations[0].init;
    const nextSibling = path.getNextSibling();
    //console.log("need remove nextsibling is::"+nextSibling)
    if (!nextSibling) {
        console.log("need remove nextsibling is null");
        return;
    }
    path.getNextSibling().remove();
    //console.log("before getnextsibling is::"+path.getNextSibling())
    path.getNextSibling().node.declarations[0].init=node.declarations[0].init;
    //console.log("after getnextsibling is::"+generate(path.getNextSibling().node.declarations[0].init).code)
}

function func_replace(path){
    const node=path.node;
    const scope=path.scope;
    const left_name=node.id.name;
    try{
        if(!node.init)
        {
            return;
        }
        if(generate(node.init).code!=="_ᖁᕹᖁᕾ.$_CV") return;
    }catch (error){
        console.log("has a mistake in func_replace");
    }

    let bind_left=scope.getBinding(left_name);
    if(bind_left.referencePaths.length!==0){
        bind_left.referencePaths.forEach(function(path){
            const left_path=types.identifier("_ᖁᕹᖁᕾ");
            const right_path=types.identifier("$_CV");
            const replace_path=types.memberExpression(left_path,right_path);
            path.replaceWithMultiple(replace_path);
        })
    }
    path.remove();
}

//解密unicode
function de_str(path){
    delete path.node.extra.raw;
}


const visitor={
    StringLiteral(path) {
        de_str(path);
    },
    // 你可以为其他类型的节点添加处理函数
    VariableDeclaration(path) {
        decode_replace(path);  // 处理 VariableDeclaration 节点
    },
    VariableDeclarator(path) {
        func_replace(path);  // 处理 VariableDeclarator 节点
    }
    // Identifier(path) {
    //     extra_unicode_name(path);
    // }
}

//解密字符串
function decrypt(ast){
    traverse(ast,visitor)
    let end=5
    let newarry=parser.parse('');
    newarry.program.body=ast.program.body.slice(0,end);
    let stringdecryptfunction=generate(newarry,{compact: true}).code;
    eval(stringdecryptfunction);

    const stringdecryptfunctionast=newarry.program.body[2]
    const decryptleftname=stringdecryptfunctionast.expression.left.object.name;
    const decryptrightname=stringdecryptfunctionast.expression.left.property.name;

    traverse(ast, {
        CallExpression(path){
            if( types.isMemberExpression(path.node.callee)&&
                path.node.callee.object&&path.node.callee.object.name===decryptleftname&&
                path.node.callee.property.name&&path.node.callee.property.name===decryptrightname)
            {
                path.replaceWith(types.valueToNode(eval(path.toString())))
            }
        }
    });
    return ast;
}

// function extra_unicode_name(path) {
//     const name = path.node.name;
//     if(!name) return;
//     // 如果标识符中不包含英文字符，才加入到 names 数组
//     if (!hasEnglishLetters(name)) {
//         names.add(name);  // 使用 add() 方法加入 Set，自动去重
//     }
// }

// function replace_unicode(path) {
//     const name = path.node.name;
//     if (!name) return;
//     // 如果是非英文字符的标识符
//     if (!hasEnglishLetters(name)) {
//         // 如果没有映射，则创建一个新的映射
//         if (!nameMap.has(name)) {
//             const letter = getNextLetter(names.size);  // 根据当前名称的大小来生成字母
//             nameMap.set(name, letter);  // 将映射关系存入 map
//         }
//         // 替换标识符为对应的字母
//         path.node.name = nameMap.get(name);
//     }
// }

// function getNextLetter(counter) {
//     const alphabet = 'abcdefghijklmnopqrstuvwxyz';
//     let result = '';
//     while (counter >= 0) {
//         result = alphabet[counter % 26] + result;
//         counter = Math.floor(counter / 26) - 1;  // 如果超过 'z'，生成两位字母
//     }
//     return result;
// }



//console.log(names)


// names=[...names]
// const nameMap = new Map();
// // 给每个名称分配一个字母或字母组合
// names.forEach((name, index) => {
//     const letter = getNextLetter(index);  // 获取字母
//     nameMap.set(name, letter);  // 将标识符和字母对应放入 Map
// });
// traverse(ast,{
//     Identifier(path) {
//         replace_unicode(path);  // 在 Identifier 节点上执行替换操作
//     }  // 在 Identifier 节点上执行替换操作
// })

// 使用 CommonJS 导出
module.exports = {
    decrypt
};
