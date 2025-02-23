/*
name:三目表达式解混淆插件
time:2025.12.15
*/

const traverse = require('@babel/traverse').default;
const type = require('@babel/types');
const {returnStatement} = require("@babel/types");

//----------------------------------------------------------------------
//去除void
let deletevoid={
    "UnaryExpression"(path){
        let opt=path.node.operator;
        if(opt==='void'){
            let arg=path.node.argument;
            if(arg.type==="NumericLiteral") return
            path.replaceInline(arg);
        }
    }
};

// 通用分支处理函数
const processBranch = (branch) => {
    if (branch.type  === 'SequenceExpression') {
        // 逗号表达式 -> 代码块
        return type.blockStatement(
            branch.expressions.map(v  => type.expressionStatement(v))
        );
    } else if (branch.type  === 'ConditionalExpression') {
        // 嵌套三元表达式 -> 递归生成if-else
        return type.ifStatement(
            branch.test,
            processBranch(branch.consequent),
            processBranch(branch.alternate)
        );
    } else if (branch.type  === 'LogicalExpression') {
        // 逻辑表达式转条件控制
        if (branch.operator  === '&&') {
            return type.ifStatement(
                branch.left,
                processBranch(branch.right)
            );
        } else if (branch.operator  === '||') {
            return type.ifStatement(
                type.unaryExpression('!',  branch.left),
                processBranch(branch.right)
            );
        }
    } else if (
        branch.type  === 'AssignmentExpression' ||
        branch.type  === 'CallExpression'
    ) {
        // 单表达式包装为代码块
        return type.blockStatement([type.expressionStatement(branch)]);
    }
    // 默认处理
    return type.blockStatement([type.expressionStatement(branch)]);
};

//逗号表达式拆解为多行语句+递归处理嵌套三元表达式+&&转if+单行赋值包装为代码块+赋值语句右侧嵌套三元表达式的识别与转换
let ConditionalExp = {
    "ExpressionStatement"(path) {
        if (path.node.expression.type  === 'ConditionalExpression') {
            let path_ = path.node.expression;
            let test = path_.test;
            let consequent = path_.consequent;
            let alternate = path_.alternate;
            // 处理左右分支
            consequent = processBranch(consequent);
            alternate = processBranch(alternate);
            // 生成最终if-else结构
            let ifSta = type.ifStatement(test,  consequent, alternate);
            path.replaceWith(ifSta);
        }
    }
};

//重构条件表达式结构
function convert_symbol(operator){
    let res;
    switch (operator){
        case "===":
        case "==":
        case "!==":
        case "&":
            res = operator;
            break;
        case "<":
            res = ">";
            break;
        case "<=":
            res = ">=";
            break;
        case ">":
            res = "<";
            break;
        case ">=":
            res = "<=";
            break;
        default:
            throw "符号调换有新情况" + operator;

    }
    return res;
}
function replace_left_right(path) {
    const node = path.node;
    if (path.isIfStatement() && type.isBinaryExpression(node.test)) {
        const test = node.test;
        if (type.isLiteral(test.left) && type.isIdentifier(test.right)) {
            // 调换左右
            const temp = test.left;
            test.left = test.right;
            test.right = temp;
            // 符号转换
            test.operator = convert_symbol(test.operator);
        }
    }
    if (path.isSwitchStatement() && type.isBinaryExpression(node.discriminant)) {
        const discriminant = node.discriminant;
        if (type.isLiteral(discriminant.left) && type.isIdentifier(discriminant.right)) {
            // 调换左右
            const temp = discriminant.left;
            discriminant.left = discriminant.right;
            discriminant.right = temp;
            // 符号转换
            discriminant.operator = convert_symbol(discriminant.operator);
        }
    }
}

let ConvertSy={
        "enter"(path) {
        // 调用 replace_left_right 处理相关节点
        if (path.isIfStatement() || path.isSwitchStatement()) {
            replace_left_right(path);
        }
    }
}

//
const processBranch1 = (left, operator, branch) => {  // 新增left和operator参数
  const createAssignment = (value) =>
    type.assignmentExpression(operator,  left, value);  // 动态创建赋值表达式

  if (branch.type  === 'SequenceExpression') {
    return type.blockStatement([
      ...branch.expressions.map(expr  => type.expressionStatement(expr)),
      type.expressionStatement(createAssignment(type.identifier('undefined')))  // 处理逗号表达式返回值
    ]);
  }
  if (branch.type  === 'ConditionalExpression') {
    return type.ifStatement(
      branch.test,
      processBranch(left, operator, branch.consequent),
      processBranch(left, operator, branch.alternate)
    );
  }
  return type.blockStatement([
    type.expressionStatement(createAssignment(branch))   // 核心修改：包装赋值语句
  ]);
};

const ConditionalExpPlus = {
  "ExpressionStatement"(path) {
    const expr = path.node.expression;
    if (!type.isAssignmentExpression(expr))  return;

    const { left, operator, right } = expr;
    if (!type.isConditionalExpression(right))  return;

    // 生成if-else结构
    const ifSta = type.ifStatement(
      right.test,
      processBranch1(left, operator, right.consequent),   // 传递左值和操作符
      processBranch1(left, operator, right.alternate)
    );

    path.replaceWith(ifSta);   // 直接替换为控制流语句
  }
};

function CondExp(ast,plus){
    traverse(ast,deletevoid)
    traverse(ast,ConditionalExp)
    traverse(ast,ConvertSy)
    if(plus){
        traverse(ast,ConditionalExpPlus)
    }
    return ast;
}


module.exports = {
    CondExp
};



