const traverse = require("@babel/traverse").default;

function UnicordOb(ast){
    const transform_literal = {
    StringLiteral({node}) {
        // 检查并处理转义字符
        if (node.extra && /\\[ux]/gi.test(node.extra.raw)) {
            // 将转义字符转换为实际字符
            node.extra = undefined;  // 清除 extra 信息，因为不再需要 raw 属性
        }
    }
};
// 遍历并应用转换
traverse(ast, transform_literal);
return ast;
}

// 使用 CommonJS 导出
module.exports = {
    UnicordOb
};

