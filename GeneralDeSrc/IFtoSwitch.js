
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");


let status_variable=[]
let state_table = {};
let num=0
let tmp=0
let break_node = t.breakStatement(); // 构造合法的 BreakStatement 节点

//检查 if 条件中的变量是否包含在 parentNode.status 中，即判断 node.consequent[0] 是否涉及到状态变量
function is_status(node) {
    if (node && node.status !== undefined) {
        //console.log("Checking status:", node.status);
        return status_variable===node.status// 判断状态是否在指定集合中
    }
    //console.log("Checking status error");
    return false;
}

//核心函数
function if_to_switch(node) {
    let num = 0; // 状态编号
    let index = 0; // 当前状态编号
    let test = { name: tmp }; // 假设我们使用 "test" 作为状态变量名称
    let curr_code = ``;
    // 初始的 switch 语句模板，使用 test.name
    let code = `switch(${test.name}) {}`;
    let new_node = parser.parse(code).program.body[0];
    let init_state = []; // 初始化状态记录数组
    // 假设 curr_code 是被混淆的 JS 代码
    curr_code = generate(node).code;
    console.log("模拟执行开始");
    // 模拟执行，直到遇到重复的结果为止
    while (true) {
        index = num++; // 当前状态编号
        // 构建 eval_code，更新 test.name 为当前状态编号
        let eval_code = `${tmp} = ${index};\n${curr_code}\n ${tmp};`;
        // 使用 eval 执行代码并获取状态值
        let res_num = eval(eval_code);
        // 检查是否遇到重复的状态值，避免死循环
        if (init_state.includes(res_num)) {
            break; // 如果是重复的状态值，结束模拟
        }
        init_state.push(res_num); // 记录当前状态值
        // 获取对应状态的语句块，默认是空数组
        let res = state_table[res_num] || [];
        // 添加 break 语句到语句块
        res.push(break_node);
        // 构建 SwitchCase 节点
        const switch_case = t.switchCase(
            t.numericLiteral(index), // case 的值
            res // case 对应的语句块
        );
        // 将 case 添加到 switch 节点
        new_node.cases.push(switch_case);
    }
    // 返回生成的 switch 语句 AST 节点
    return new_node;
}

//for 循环内的第一条语句上，有运算的变量 都有可能是状态变量(有些是中间变量)，而且是嵌套内的控制流的状态变量，所以我们需要收集这几个变量，来判断是否在控制流
let collectVar={
        ForStatement(path) {
            const { node } = path;
            //console.log("status is :"+node.body.body[1].status)
                    // 修复 1：校验 body 类型
            if (!t.isBlockStatement(node.body))  return;
            if (node.body.body.length === 2 && node.body.body[1].type=== "SwitchStatement") {
                // 收集控制流的状态变量
                status_variable = [node.init.declarations[0].id.name];
                //console.log("first is  "+node.init.declarations[0].id.name);
                if (node.body.body[0].type === "VariableDeclaration") {
                    let init_status = node.body.body[0].declarations;
                    for (let i = 0; i < init_status.length; i++) {
                        if (init_status[i].init && init_status[i].init.type === "BinaryExpression"){
                            tmp=init_status[i].id.name
                            status_variable.push(tmp);
                            //console.log("init_status[i].id.name is:   "+init_status[i].id.name)
                        }
                    }
                }
                //在控制流的switch节点上 加上了两个属性，都是状态变量，方便于后面找出属于控制流的判断语句
                node.body.body[1].status = status_variable;
                //console.log("status is :"+status_variable);
                node.body.body[1].init_num = node.init.declarations[0].init.value;
            }
        },
};

//嵌套的 switch 节点要加上去，同理嵌套的 if 也要
let Switch={
    SwitchCase(path){
            // 这个case 是有些switch是嵌套的 原本是在匿名函数的 经过 swap_test 处理，变成简单的嵌套在控制流上
            let node=path.node;
            let parentNode=path.parentPath.node
            if (node.consequent.length !== 2){
                //console.log("嵌套的 switch 节点要加上去，同理嵌套的 if 也要----出错");
                return ;
            }
            if (node.consequent[0].type === "SwitchStatement"){
                let sw_node = node.consequent[0];
                switch (sw_node.discriminant.type){
                    case "Identifier":
                        if (parentNode.status.indexOf(sw_node.discriminant.name) > -1){
                            sw_node.status = parentNode.status;
                            //console.log("switch identifier:"+sw_node.status);
                        }
                        break;
                    case "BinaryExpression":
                        if (parentNode.status.indexOf(sw_node.discriminant.left.name) > -1){
                            sw_node.status = parentNode.status;
                            //console.log("switch binaryexpression:"+sw_node.status);
                        }
                        break;
                }
                //path.replaceWithMultiple(sw_node);
            }else if(node.consequent[0].type ==="IfStatement"){
                let if_node = node.consequent[0];
                if (if_node.test.left  &&
                    Array.isArray(parentNode?.status)  &&  // 防御性校验
                    parentNode.status.indexOf(if_node.test.left.name)  > -1 ){
                    if_node.status = parentNode.status;
                    //console.log("if语句嵌套添加成功0：:"+if_node.status);
                }
            }
        }
};

let IfState= { // 额外添加对 IfStatement 的处理
    IfStatement(path) {
        let node=path.node;
       if(node.status)  return;
       if(node.test.left&&status_variable.includes(node.test.left.name)){
           node.status=status_variable
           //console.log("ifstatment status is :"+status_variable);
       }

    }
};

//收集代码块有对应关系
let CollectCodeMap={
    BlockStatement(path) {
        let curnode = path.node;  // 当前块节点
        let parent = path.parent; // 父节点
        // 检查父节点是否为控制流状态
        if (is_status(parent)) {
            // 检查当前块的第一个语句是否也是控制流状态
            if (curnode.body.length > 0 && is_status(curnode.body[0])) {
                console.log("收集代码块有对应关系出错");
                return;  // 跳过处理
            }
            // 保存当前块到状态表并分配唯一编号
            state_table[num] = curnode.body;
            //console.log(`state_table[${num}]:`, generate({ type: "Program", body: curnode.body }).code);
            // 解析生成新代码
            const test = { name: tmp }; // 定义 test 对象
            const newCode = `${test.name} = ${num++};`; // 生成新代码
            const parsedCode = parser.parse(newCode);
            // 检查解析结果，并确保 curnode.body 更新为正确的内容
            if (parsedCode && parsedCode.program && Array.isArray(parsedCode.program.body)) {
                curnode.body = parsedCode.program.body;  // 确保替换为有效的 AST
            } else {
                console.error("解析后的 AST 不符合预期结构:", parsedCode);
            }
            // 输出新的 curnode.body
            // if (curnode.body) {
            //     console.log("新的 curnode.body:", generate(curnode).code);
            // } else {
            //     console.log("curnode.body is undefined or empty");
            // }
            // 替换原节点
            path.replaceWith(curnode);
        }
    }
};

//标志加上了，可以在 leave 遍历处加上 真正将 if-else 转 switch 语句的逻辑
let Start= {
    SwitchCase(path) {
        let curnode = path.node;       // 当前 SwitchCase 节点
        let parent = path.parent; // 父 SwitchStatement 节点
        if (
            curnode.consequent[0].type === "IfStatement" &&
            is_status(parent)) {
            try {
                // 转换 IfStatement 为 SwitchStatement
                curnode.consequent[0] = if_to_switch(curnode.consequent[0]);
                console.log("改造成功: 已将 IfStatement 转为 SwitchStatement");
            } catch (error) {
                console.error("改造失败: 转换 IfStatement 时出错", error.message);
            }
        }
    },
};

function IFtoSwitch(ast){
    traverse(ast,collectVar);
    traverse(ast,Switch);
    traverse(ast,IfState);
    traverse(ast,CollectCodeMap);
    traverse(ast,Start);
}

function IFtoSwitch1(bodyPath) {
  // 阶段式处理（自动继承作用域）
  const processingSteps = [collectVar, Switch, IfState, CollectCodeMap, Start];

  processingSteps.forEach(visitor  => {
    // 创建临时根节点（关键修复）
    const tempRoot = t.file(t.program([bodyPath.node]));

    traverse(tempRoot, {
      Program(path) {
        path.traverse(visitor);
      }
    });
  });
}

// ================ 安全遍历入口 ================
function Func_IFtoSwitch(ast) {
  traverse(ast, {
    FunctionDeclaration(path) {
      if (!t.isBlockStatement(path.parent))  return;

      // 创建上下文保留的克隆体
      const clonedBody = t.cloneNode(path.node.body,  true);

      // 生成合法路径对象
      const newBodyPath = path.get('body').replaceWith(clonedBody)[0];

      // 传递完整路径上下文
      IFtoSwitch1(newBodyPath);
    }
  });
}

module.exports = {
    IFtoSwitch,
    Func_IFtoSwitch
};
