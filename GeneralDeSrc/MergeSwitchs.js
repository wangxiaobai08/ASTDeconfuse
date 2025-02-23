
const traverse = require("@babel/traverse").default;
const types = require("@babel/types");
const generate = require("@babel/generator").default;
const t = require("@babel/types");

let status_variable=[]
let status_switch_table=[]
let num1=0;
let break_node = t.breakStatement(); // 构造合法的 BreakStatement 节点

//三重switch合并一重
function generateSwitchFromStates(node) {
  let initState = []; // 初始化状态
  let num2 = 0; // 状态编号
   let test = { name: status_name };
   let curnode1=node.body[0];
  let curnode2=node.body[1];
  let currCode1 = generate(curnode1).code;
  let currCode2 = generate(curnode2).code;
  let new_node = {
  type: "SwitchStatement",
  discriminant: t.identifier(status_name),  // 假设状态变量名为 'status'
  cases: []  // 确保 cases 被初始化为空数组
};
  while (true) {
        let index1 = status_list[num2++];
        let evalCode = `var ${status_name} = ${index1};\n${currCode1}\n${currCode2}\n${status_name};`;
        let resNum=0;
        resNum = eval(evalCode); // 执行代码，获取结果
        //console.log("resNum is: "+resNum);
        if (status_list && num2 > status_list.length) {
          break;
        }
        if (initState.includes(resNum)) {
          break;
        }
        initState.push(resNum);
        let res1 = status_switch_table[resNum]|| [];
        if (!res1) {
          console.log("222 status_switch_table[resNum] is undefined for resNum: ", resNum);
       }
        if (typeof index1 !== "number") {
      console.error("index 应该是一个数字，但现在是：", typeof index, index);
    }
    if (!Array.isArray(res1)) {
      console.error("res 应该是一个数组，但现在是：", typeof res1, res1);
    }
    // 构建 SwitchCase 节点
      const switch_case = types.switchCase(
            types.numericLiteral(index1), // case 的值
            res1 // case 对应的语句块
        );
        // 将 case 添加到 switch 节点
        new_node.cases.push(switch_case);
  }
  return new_node;
}

let status_list=[]
let status_name=''

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

//找到控制流
let Findcontrol={
    ForStatement(path){
        let node=path.node
        // 找到控制流 status 是上面 if 转 switch 遗留下来的 这里就不需要再判断别的了
    if (
        t.isBlockStatement(node.body)  &&       // 确保 body 是代码块
        node.body.body?.length  === 2 &&        // 代码块包含 2 条语句
        node.body.body[1]?.status  !== undefined // 检查第二语句的 status 属性
    ){
        status_name = node.init.declarations[0].id.name;
        status_list = [node.init.declarations[0].init.value];
        console.log("status_name is:"+status_name+"---status_list is:"+status_list)
    }
    }
};

//收集整个控制流的所有状态变量
let Collectstate= {
    AssignmentExpression(path) {
      const { node } = path;
      const left = node.left;
      const right = node.right;

      // 类型校验层
      if (!t.isIdentifier(left)  || left.name  !== status_name) return;
      if (t.isUnaryExpression(right)  && right.operator  === "void") return;

      // 严格类型检查
      const allowedTypes = new Set([
        'NumericLiteral',
        'StringLiteral',
        'BooleanLiteral'
      ]);

      if (!allowedTypes.has(right.type))  {
        const errorMsg = `检测到非常规状态赋值，类型：${right.type}\n 代码段：${generate(right).code}`;
        throw new Error(errorMsg);
      }

      // 值收集与去重
      const value = right.value;
      if (!this.collectedStates)  this.collectedStates  = new Set();

      if (!this.collectedStates.has(value))  {
        this.collectedStates.add(value);
        status_list.push(value);
      }
    }
  };

//然后收集每个case对应的语句块，保存对应关系，然后case里面的语句块改掉，直接改成和上面的 if 转 switch的形式
let Collectcase= {
  // 处理 SwitchCase 节点
  SwitchCase(path) {
    const node = path.node;
    const parentNode = path.parent;
    // 检查条件是否满足
    if (node.consequent[0] && t.isSwitchStatement(node.consequent[0]) && status_variable.includes(node.consequent[0].discriminant.name)) {
        //console.log("条件成立，不做任何修改");
        return;  // 如果条件成立，不做任何修改
    }
    if ((t.isBinaryExpression(parentNode.discriminant) && !status_variable.includes(parentNode.discriminant.left.name)) ||
        (t.isIdentifier(parentNode.discriminant) && !status_variable.includes(parentNode.discriminant.name))) {
        //console.log("parentNode.discriminant.left.name is:"+parentNode.discriminant.name);
        //console.log("状态不一致，不做修改");
      return;  // 如果状态不一致，不做修改
    }

    // 修改 state_table，记录当前的 switch case
    status_switch_table[num1] = node.consequent;
    // node.consequent.forEach((statement, index) => {
    // try {
    //     const code = generate(statement).code;
    //     console.log(`Statement11 ${index + 1}:`, code);
    // } catch (error) {
    //     console.error("Error generating code for statement:", error.message);
    // }
    // });

    // 创建赋值表达式节点
    const assignmentExpression = t.assignmentExpression(
    '=',
    t.identifier(status_name),
    t.numericLiteral(num1++)
    );
    // 创建表达式语句节点
    const expressionStatement = t.expressionStatement(assignmentExpression);
    node.consequent=[expressionStatement];
    // 创建完整 consequent 数组
    node.consequent.push(break_node)
  }
};

//模拟执行所有状态变量的值，整合成ast
let Start= {
    BlockStatement(path) {
        let curnode = path.node;
        let parent = path.parent;
        // console.log("parent1:"+generate(parent).code);
        //检查条件：父节点有 status，当前 case 的第一个语句是 IfStatement，且符合状态条件
        //console.log("consequent type is :"+curnode.consequent[0].type);
        if (curnode.body[1] && curnode.body[1].type === "SwitchStatement"&&parent.type==="ForStatement") {
    try {
        curnode.body[1] = generateSwitchFromStates(curnode);
        console.log("改造成功: 已将 IfStatement 转为 SwitchStatement");
    } catch (error) {
        console.error("改造失败: 转换 SwitchStatement 时出错", error.message);
    }
}
    },
};

function MergeSwitchs(ast){
    traverse(ast,collectVar);
    traverse(ast,Findcontrol);
    traverse(ast,Collectstate);
    traverse(ast,Collectcase);
    traverse(ast,Start);
}


function MergeSwitch1(bodyPath) {
  // 阶段式处理（自动继承作用域）
  const processingSteps = [collectVar,Findcontrol, Collectstate, Collectcase, Start];

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


function Func_MergeSwitch(ast) {
  traverse(ast, {
    FunctionDeclaration(path) {
      if (!t.isBlockStatement(path.parent))  return;

      // 创建上下文保留的克隆体
      const clonedBody = t.cloneNode(path.node.body,  true);

      // 生成合法路径对象
      const newBodyPath = path.get('body').replaceWith(clonedBody)[0];

      // 传递完整路径上下文
      MergeSwitch1(newBodyPath);
    }
  });
}

module.exports = {
    MergeSwitch: MergeSwitchs,
    Func_MergeSwitch
};