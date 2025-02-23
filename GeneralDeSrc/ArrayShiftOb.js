/*
name:数美OB解混淆插件(标准数组偏移型加密)
time:2024.12.13
author: 农民工学编程
注意事项：使用时务必将【大数组】和【解密函数】提取到自执行函数外部，否则容易出错
解混淆思路：
1:
    获取大数组
    获取数组位移
    获取解密函数
2:
    运行数组位移函数
    所有应用替换
    解密函数执行替换
    优化加密函数逻辑
*/

const traverse = require("@babel/traverse").default;
const parser = require("@babel/parser");
const generator = require("@babel/generator").default;
const types = require('@babel/types');

function RecursiveAssignment(path, pPathString) {
    eval(global["largeArray"]); //加载大数组
    eval(pPathString); //加载解密函数
    eval(global["ChangeArrayOrder"])
    if (!pPathString || !global["largeArray"] || !global["ChangeArrayOrder"]) {
        throw "有些没解析全，退出"
    }
    // 递归函数，因为他的引用又是一个赋值新变量操作
    //代码长这样子的：var _0x1e4a2f = _0x4a9d; console.log(_0x4a9d(100));
    let {name} = path.node.id;
    let binding = path.scope.getBinding(name);
    for (p of binding.referencePaths) {
        let pPath = p.parentPath;
        let {node} = pPath;
        if (node.type === "VariableDeclarator") {
            let leftName = node.id.name;
            let rightName = node.init.name;
            //console.log("似乎要把解密函数"+rightName+"赋值给", leftName);
            // // 先改成解密函数的名字，
            pPath.scope.rename(leftName, rightName);
            RecursiveAssignment(pPath, pPathString);
            // // 移除掉赋值新变量名
            pPath.remove();
        }
        //console.log(pPath.toString());
        // 判断是调用函数，替换节点
        if (node.type === "CallExpression" && node.arguments.length === 1 && node.arguments[0].type === "NumericLiteral") {
            let pPathCode = pPath.toString();
            let result = eval(pPathCode)
            // console.log(pPathCode, ":", result);
            pPath.replaceWith(types.valueToNode(result))
        }
    }
}


// 获取解密函数代码
let getDecryption = {
    "FunctionDeclaration"(path) {
        // 判断函数是不是需要传两个参数
        let {node} = path;
        let {body} = node;
        if (!node.params || node.params.length !== 2) return;
        if (!body || !body.body) return;
        let lastReturn = body.body.at(-1)
        if (lastReturn.type !== "ReturnStatement" || !lastReturn.argument || !lastReturn.argument.expressions) return;
        let lastCall = lastReturn.argument.expressions.at(-1)
        if (lastCall.type !== "CallExpression" || lastCall.arguments.length !== 2) return;
        let name = node.id.name;
        console.log("解密函数的名字是:", name);
        let decryAst = parser.parse(path.toString());
        let decryCode = generator(decryAst, opts = {"compact": true}).code;
        RecursiveAssignment(path, decryCode);
        // 移除解字符串函数
        path.remove();
    }
}


var getDecName = (path) => {
    // 这个函数 通过大数组的作用域传入同级作用域 来获得解密函数
    let {scope} = path;
    scope.traverse(scope.block, getDecryption);
}

//获取大数组
let getArray = {
    "VariableDeclarator"(path) {
        let {id, init} = path.node;
        // 判断var右边是不是数组类型
        if (!init || init.type !== "ArrayExpression" || init.elements.length < 1) return;

        //此处排查操作欠妥！！！！！！！！--后续重新考虑
        if(init.elements.length>1 && init.elements.length < 100) return;

        // 获取作用域
        let binding = path.scope.getBinding(id.name);
        // 如果作用域的引用次数等于0，就说明不是，那就删除并且返回
        if (binding.references === 0) {
            path.remove;
            return
        }
        // every 遍历数组 判断全部的成员的是否为StringLiteral
        if (init.elements.every(element => element.type === "StringLiteral")) {
            //获取父级函数，如果没有就说明是最外层定义的数组
            let funcName = path.getFunctionParent();
            if (funcName === null) {
                console.log("大数组名字应该是：", id.name)
                global["largeArray"] = path.toString();
                path.remove;
                // 父级作用域传给另外一个函数操作
                getDecName(path.parentPath)
            } else {
                // 获取最后一个返回的函数名 和父级函数名对比，如果一样 就eval
                let lastElement = funcName.node.body.body.at(-1)
                if (!lastElement.argument || !lastElement.argument.callee) return;
                if (lastElement.type !== "ReturnStatement" && lastElement.argument.callee.name !== funcName.node.id.name) return;
                console.log("大数组名字应该是函数名：", funcName.node.id.name)
                let largeArrayAst = parser.parse(funcName.toString());
                global["largeArray"] = generator(largeArrayAst, opts = {"compact": true}).code;
                // 父级作用域传给另外一个函数操作 获取解字符串函数
                getDecName(funcName.parentPath)
                // 移除掉大数组
                funcName.remove()
            }
        }
    },
}

//获取自执行函数(第一个自执行会改变大数组的顺序)
let GetSelfexecutingfunctions={
    "CallExpression"(path) {
        let {node} = path;
        if (!node.callee || node.callee.type !== "FunctionExpression") return;
        if (!node.arguments || node.arguments.length !== 2) return;

        if (node.arguments[0].type !== "Identifier") return;
        if (node.arguments[1].type === "Identifier") return;
        // 修改大数组的是一个匿名函数，这里加个感叹号让他语法没问题
        // 转ast再转js代码 使用了压缩，防止toString检测导致内存爆破卡死。
        let changeAst = parser.parse("!" + path.toString());
        let ChangeArrayOrder = generator(changeAst, opts = {"compact": true}).code;
        console.log("改变数组顺序的自执行代码：", ChangeArrayOrder)
        global["ChangeArrayOrder"] = ChangeArrayOrder;
        path.remove();
    }
}

//优化加密逻辑
let optimise={
        // 优化加减乘除操作
        "BinaryExpression": {
            exit(path) {
                let {node} = path;
                let {left} = node;
                let {right} = node;
                if ((left.type === "UnaryExpression" || left.type === "NumericLiteral") && (right.type === "UnaryExpression" || right.type === "NumericLiteral")) {
                    let leftValue;
                    let rightValue;
                    if (left.type === "NumericLiteral") {
                        leftValue = left.value
                    } else {
                        if (!left.argument.value) return;
                        if (left.operator === "-") {
                            leftValue = -left.argument.value
                        }
                    }
                    if (right.type === "NumericLiteral") {
                        rightValue = right.value
                    } else {
                        if (!right.argument.value) return;
                        if (left.operator === "-") {
                            rightValue = -right.argument.value
                        }
                    }
                    if (!leftValue) return;
                    //console.log(leftValue, node.operator, rightValue);
                    path.replaceWith(types.valueToNode(path.evaluate(leftValue + node.operator + rightValue).value));
                }
            }
        },
        //解对象
        "VariableDeclarator"(path) {
            // 其他的话对局部数组做的，比如代码：
            // var _0x4b4e24 = {
            //     "Xpwku": "<div id=\"",
            //     "WuoUF": function (_0x3e6935, _0x10f1b1) {return _0x3e6935 + _0x10f1b1;}}
            let {node} = path;
            let {id, init} = node;
            if (!init || init.type !== "ObjectExpression") return;
            if (!init.properties || init.properties.length < 1) return;
            let Array2Name = id.name;
            //新建一个对象。把原来的对象右边(value)保存为Node
            let NewObject = {};
            for (v of init.properties) {
                NewObject[v.key.value] = v.value;
            }
            let binding = path.scope.getBinding(Array2Name)
            // 新建一个操作次数，如果数组的引用节点都操作了的话 次数加一 如果等于所有次数，就说明全修改了，可以删除定义的节点了
            let modificationNum=0
            for (p of binding.referencePaths.reverse()) {
                // 此时的p是数组名称，要父级path才有成员名
                let pPath = p.parentPath;
                let {node} = pPath;
                // 获取调用数组成员的名字，再放进新对象查一下是字符串还是函数，如果是函数，还要往上找父级path,类型才是CallExpression
                // 如果没有property 说明不是调用某个成员，可能是要调用或赋值自己给其他的
                if (!node.property) return;
                const parentTry = pPath.findParent(parent => parent.isTryStatement());
                if(parentTry) continue;
                let keyName = node.property.value;
                let rightNode = NewObject[keyName]
                if (!NewObject[keyName]) return
                if (rightNode.type === "StringLiteral") {
                    console.log("旧代码111", pPath.toString())
                    pPath.replaceWith(types.valueToNode(rightNode.value));
                    modificationNum+=1
                    console.log("新代码111", pPath.toString())
                    console.log("-------------------")
                } else if (rightNode.type === "FunctionExpression") {
                    // 此时这里的pPath.node为_0xa7a3b2["JHTcH"] 还要上一级才会有arguments的东西
                    node = pPath.parentPath.node;
                    let {parentPath} = pPath
                    if (node.type !== "CallExpression") return;
                    if (!rightNode.body || !rightNode.body.body) return;
                    let bodyResult = rightNode.body.body[0];
                    if (bodyResult.type !== "ReturnStatement") return;
                    let {arguments} = node;
                    //BinaryExpression 就是长这样的代码 return _0x398914 == _0x5433f6;
                    if (bodyResult.argument.type === "BinaryExpression") {
                        let {operator} = bodyResult.argument
                            // 只有一个参数，说明是判断类型的，右边固定
                            if (arguments.length === 1) {
                                parentPath.replaceWith(types.binaryExpression(operator, node.arguments[0], bodyResult.argument.right))
                                modificationNum+=1
                            } else if (arguments.length === 2) {
                                     console.log("旧代码222", pPath.toString())
                                    parentPath.replaceWith(types.binaryExpression(operator, node.arguments[0], node.arguments[1]))
                                    modificationNum+=1
                                    console.log("新代码222", parentPath.toString())
                                    console.log("-------------------")
                            }
                    }else if(bodyResult.argument.type==="LogicalExpression"){
                        parentPath.replaceWith(types.logicalExpression("||", node.arguments[0], node.arguments[1]))
                        modificationNum+=1
                    }else if (bodyResult.argument.type === "CallExpression") {
                        if (node.arguments.length >= 1) {
                                    // console.log("旧代码", pPath.parentPath.toString())
                                    pPath.parentPath.replaceWith(types.callExpression(node.arguments[0], node.arguments.slice(1)));
                                    modificationNum+=1
                                    // console.log("新代码", pPath.parentPath.toString())
                                    // console.log("-------------------")
                        }
                    }
                }
            }
            if(modificationNum===binding.referencePaths.length){
                // console.log("删除了一个小数组。")
                path.remove()
            }
        }
    
}

function Obdeconfuse(ast,optimise) {

    traverse(ast,GetSelfexecutingfunctions);
    traverse(ast,getArray);
    if(optimise){
        traverse(ast,optimise);
    }
    return ast;
}

// 使用 CommonJS 导出
module.exports = {
    Obdeconfuse
};

