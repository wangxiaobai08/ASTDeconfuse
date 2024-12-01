const traverse = require('@babel/traverse').default;
const types = require('@babel/types');

// 用于包装表达式为有效的语句类型
function wrapExpressionWithStatement(expression) {
    if (types.isSequenceExpression(expression)) {
        // 如果是SequenceExpression，包裹为ExpressionStatement
        return types.blockStatement([types.expressionStatement(expression)]);
    }
    // 否则，直接作为ExpressionStatement
    return types.blockStatement([types.expressionStatement(expression)]);
}
// 递归展开条件表达式的子节点，确保生成 if-else 结构
function expandConditionalExpression(node) {
    if (types.isConditionalExpression(node)) {
        const { test, consequent, alternate } = node;

        // 将conditional expression拆成if-else
        const ifStatement = types.ifStatement(
            test,
            types.isConditionalExpression(consequent) ? expandConditionalExpression(consequent) : wrapExpressionWithStatement(consequent),
            types.isConditionalExpression(alternate) ? expandConditionalExpression(alternate) : wrapExpressionWithStatement(alternate)
        );

        return ifStatement;
    }

    return node;
}
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

    if (path.isIfStatement() && types.isBinaryExpression(node.test)) {
        const test = node.test;
        if (types.isLiteral(test.left) && types.isIdentifier(test.right)) {
            // 调换左右
            const temp = test.left;
            test.left = test.right;
            test.right = temp;
            // 符号转换
            test.operator = convert_symbol(test.operator);
        }
    }

    if (path.isSwitchStatement() && types.isBinaryExpression(node.discriminant)) {
        const discriminant = node.discriminant;
        if (types.isLiteral(discriminant.left) && types.isIdentifier(discriminant.right)) {
            // 调换左右
            const temp = discriminant.left;
            discriminant.left = discriminant.right;
            discriminant.right = temp;
            // 符号转换
            discriminant.operator = convert_symbol(discriminant.operator);
        }
    }
}
function TrinocularExpressionsToIf(ast){
      traverse(ast, {
        ConditionalExpression(path) {
            // 如果该节点已经被处理过，跳过
            if (path.node._processed) {
                return;
            }

            // 展开并生成if-else语句
            const expandedIfStatement = expandConditionalExpression(path.node);

            // 标记节点为已处理，防止重复处理
            path.node._processed = true;

            // 替换原有的 ConditionalExpression 为 ifStatement
            path.replaceWithMultiple(expandedIfStatement);

            // 跳过子节点的递归遍历，防止无限递归
            path.skip();
        }
});
      traverse(ast, {
            enter(path) {
            // 调用 replace_left_right 处理相关节点
            if (path.isIfStatement() || path.isSwitchStatement()) {
                replace_left_right(path);
            }
        }
      });
      traverse(ast, {
      IfStatement(path) {
        console.log('Found IfStatement:', path.node); // 调试：查看是否进入了 if 语句

        if (path.node.alternate) {
            const alternate = path.node.alternate;

            // 检查 else 是否为 BlockStatement，并且包含 ExpressionStatement
            if (t.isBlockStatement(alternate)) {
                const expressionStatement = alternate.body[0]; // 获取第一个语句

                // 确认该语句是否是 ExpressionStatement，且其内容为逻辑表达式
                if (t.isExpressionStatement(expressionStatement) &&
                    t.isLogicalExpression(expressionStatement.expression) &&
                    expressionStatement.expression.operator === '&&') {

                    console.log('Found logical expression in else:', expressionStatement.expression); // 调试：查看找到的逻辑表达式

                    const condition = expressionStatement.expression.left;  // 获取条件部分 (i > 3)
                    const action = expressionStatement.expression.right;    // 获取执行的动作 (console.log(...))

                    // 构建新的 else if 语句
                    const newElseIfNode = t.ifStatement(
                        condition,  // 条件部分 (i > 3)
                        t.blockStatement([t.expressionStatement(action)])  // 执行部分
                    );

                    // 将原来的 else 替换为 else if
                    path.node.alternate = newElseIfNode;

                    // 输出修改后的 AST（用于调试）
                    //console.log('Modified AST:', JSON.stringify(ast, null, 2));
                }
            }
        }
    }
});
      return ast;
}
function StateVariableTransitions(ast){
    TrinocularExpressionsToIf(ast)
    traverse(ast, {
    AssignmentExpression(path) {
        // 判断是否符合需要删除的条件（例如，我们删除所有赋值表达式）
        if (types.isAssignmentExpression(path.node)) {
            const left = path.node.left;  // 赋值左侧（变量）
            const right = path.node.right;  // 赋值右侧（三元运算符）

            // 判断右侧是否是三元运算符（ternary expression）
            if (types.isConditionalExpression(right)) {
                const test = right.test;  // 三元运算符的条件部分
                const consequent = right.consequent;  // 三元运算符的 true 分支
                const alternate = right.alternate;  // 三元运算符的 false 分支
                // 构造一个 if 语句
                const newNode = types.ifStatement(
                    test,
                    types.blockStatement([
                        types.expressionStatement(types.assignmentExpression('=', left, consequent))  // if 部分
                    ]),
                    types.blockStatement([
                        types.expressionStatement(types.assignmentExpression('=', left, alternate))  // else 部分
                    ])
                );
                // 直接替换为新的 if 语句，而不是先删除节点
                path.replaceWithMultiple(newNode);
            }
        }
    }
});
    traverse(ast, {
    IfStatement(path) {
       // console.log('Found IfStatement:', path.node); // 调试：查看是否进入了 if 语句

        if (path.node.alternate) {
            const alternate = path.node.alternate;

            // 检查 else 是否为 BlockStatement，并且包含 ExpressionStatement
            if (types.isBlockStatement(alternate)) {
                const expressionStatement = alternate.body[0]; // 获取第一个语句

                // 确认该语句是否是 ExpressionStatement，且其内容为逻辑表达式
                if (types.isExpressionStatement(expressionStatement) &&
                    types.isLogicalExpression(expressionStatement.expression) &&
                    expressionStatement.expression.operator === '&&') {

                    //console.log('Found logical expression in else:', expressionStatement.expression); // 调试：查看找到的逻辑表达式

                    const condition = expressionStatement.expression.left;  // 获取条件部分 (i > 3)
                    const action = expressionStatement.expression.right;    // 获取执行的动作 (console.log(...))

                    // 构建新的 else if 语句
                    const newElseIfNode = t.ifStatement(
                        condition,  // 条件部分 (i > 3)
                        types.blockStatement([types.expressionStatement(action)])  // 执行部分
                    );

                    // 将原来的 else 替换为 else if
                    path.node.alternate = newElseIfNode;

                    // 输出修改后的 AST（用于调试）
                    //console.log('Modified AST:', JSON.stringify(ast, null, 2));
                }
            }
        }
    }
});
    return ast;
}
// 使用 CommonJS 导出
module.exports = {
    TrinocularExpressionsToIf,
    StateVariableTransitions
};



