
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;
let numbers
let srcdir={}
let num_code
let numlist=[]
/*
num_cont 用来存储对应好的代码块
num_cont 中 key 会存在的属性:
    num 代表这个控制流数字出现了几次(被调用几次)
    red 代表代码块
    next_num 代表改控制流执行完毕后会走的下一个控制流数字
side 代表这个控制流存在在三元表达式中
new_num_cont 合并完后的新对象
num_key 获取传入对象的所有 key
*/

/*
co_code 为从对象中取出正确控制流的对象
al_code 为从对象中取出错误控制流的对象
co_next 为正确分支执行完后指向的下一个控制流数字
al_next 为错误分支执行完后指向的下一个控制流数字
co_red 为正确分支的代码块
al_red 为错误分支的代码块
co_num 为正确分支所被指向的次数
al_num 为错误分支所被指向的次数
sta 用于接收最终将代码处理完毕的语句，方便判断前面的判断有没有执行成功的
next_num 为处理完毕后指向的下一个控制流数字
co_judge 用来判断是否在 num_key, num_cont, new_num_cont 对象中删除 co 的 key
al_judge 用来判断是否在 num_key, num_cont, new_num_cont 对象中删除 al 的 key
*/

/*
red 当前控制流的代码块
value 当前控制流的数字
test 当前控制流末尾三元的判断语句
con 判断正确的控制流数字
alt 判断错误的控制流数字
num_cont 用于同步修改对象
new_num_cont、num_key 同上
end_code 为末尾的三元表达式
 */

/*
* 问题日志：
* 问题一：
* 出现在了：BlockAssociatedNumber函数的
* 正则匹配控制流数字，两种情况
li = num;
li = xx ? num1 : num2;
由于前面已经完全还原成：
* if (xx) {
          li = 2;
        } else {
          li = 0;
        }
* 导致后续对三元表达式的处理merge_nodes，出错
* 问题二：
* 对于coNestCo嵌套情况还未完善完全
* //目前可以实现对于非嵌套逻辑的还原
* */


/**
 * 打印 srcdir 中的内容为 JavaScript 代码
 * @param {Object} srcdir - 存储收集到的 AST 节点对象
 */
function printCasesAsJSCode(srcdir) {
    for (let index in srcdir) { // 使用 for...in 循环来遍历对象
        console.log(`Case ${index}:`);
        let caseContent = srcdir[index];
        if (caseContent && caseContent.length > 0) {
            caseContent.forEach(node => {
                try {
                    // 将 AST 节点转换为代码并打印
                    console.log(generate(node).code);
                } catch (error) {
                    console.error(`无法生成代码：`, error);
                }
            });
        } else {
            console.log("空内容");
        }
        console.log("\n");
    }
}

//获取控制流数字对应的代码块
function  get_code(value){
    let code
    for(let i=0;i<numlist.length;i++)
    {
        if(numlist[i]===Number(value)){
            // console.log("------------------")
            // console.log(Number(value))
            code= srcdir[i];
            //console.log(generate({ type: 'Program', body: code }).code);
            break;
        }

    }
    //    if (Array.isArray(code)) {
    //     try {
    //         // 使用 Babel 生成 JavaScript 代码
    //         console.log(generate({ type: 'Program', body: code }).code);
    //     } catch (error) {
    //         console.error("生成代码失败，检查 AST 是否正确:", error);
    //     }
    // } else {
    //     console.error("code 不是一个有效的 AST 格式", code);
    // }
       return code;
}

//存储外层的 case 语句
function case_save(p, if_name) {
    p.traverse({
        SwitchStatement(path) {
            // 确认 discriminant 是一个 Identifier，并且名字匹配
            if (!t.isIdentifier(path.node.discriminant)) return;
            if (path.node.discriminant.name !== if_name) return;

            let switch_cases = path.node.cases;

            for (let i in switch_cases) {
                if (!srcdir[i]) {
                    // 初始化 srcdir[i] 为数组，用于存储所有 consequent 的语句
                    srcdir[i] = [];

                    // 遍历每个 case 的 consequent 数组
                    switch_cases[i].consequent.forEach(function (value) {
                        if (t.isExpressionStatement(value)) {
                            // 如果是 ExpressionStatement，提取其 expression
                            srcdir[i].push(value.expression);
                        } else {
                            // 其他语句直接加入 srcdir[i]
                            srcdir[i].push(value);
                        }
                    });
                    // 检查最后一项是否是 BreakStatement
                    let lastNode = srcdir[i][srcdir[i].length - 1];
                    if (t.isBreakStatement(lastNode)) {
                        srcdir[i].pop(); // 移除 BreakStatement
                    }
                }
                // 记录 case 对应的值
                numlist[i] = switch_cases[i].test ? switch_cases[i].test.value : null;
                //console.log(numlist)
            }
        }
    });
}

//将代码块与控制流数字进行对应
function BlockAssociatedNumber(name, path) {
    // 生成代码
    let code = generate(path.node).code;

    // 使用 new RegExp 来避免 eval
    let regx1 = new RegExp(name + '\\s*=\\s*([+-]?[0-9]*\\.?[0-9]+(?:[eE][+-]?[0-9]+)?);', 'g'); // 匹配数字和科学计数法
    let regx2 = new RegExp(name + '\\s*=\\s*(.*)\\s*\\?\\s*([+-]?[0-9]*\\.?[0-9]+(?:[eE][+-]?[0-9]+)?)\\s*:\\s*([+-]?[0-9]*\\.?[0-9]+(?:[eE][+-]?[0-9]+)?);', 'g'); // 匹配三目表达式赋值
    //--------------------
    // 动态构建if-else匹配模式（支持多空格、换行）
//    const ifElsePattern =
//   `if\\s*\\([^)]+\\)\\s*{` +          // if条件部分
//   `\\s*${name}\\s*=\\s*` +            // 变量赋值
//   `([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*;` + // 真分支数值
//   `[^}]*}` +                          // 闭合代码块
//   `\\s*else\\s*{` +
//   `\\s*${name}\\s*=\\s*` +
//   `([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*;` + // 假分支数值
//   `[^}]*}`;
//
// const ifElseRegex = new RegExp(ifElsePattern, 'g');

//------------
    let num_cont = {};  // 用于存储匹配到的数字信息
    // 使用 regx1 匹配代码中的数字
    let res;
    while (res = regx1.exec(code)) {
        let key = +res[1];  // 转换为数字
        if (num_cont[key]) {
            num_cont[key]["num"]++;  // 如果已存在，增加计数
        } else {
            num_cont[key] = { "num": 1, 'red': get_code(res[1])};// 否则创建新条目
            // 获取上一个匹配的节点并处理
            let pop = num_cont[key]['red'].pop();

            // 判断 pop 是否是数字字面量
            if (t.isNumericLiteral(pop.right)) {
                num_cont[key]['next_num'] = pop.right.value + "";
            } else {
                num_cont[key]['red'].push(pop);  // 否则将其放回 red 数组
                num_cont[key]['next_num'] = -1;  // 设置 next_num 为 -1
                if (t.isReturnStatement(pop)) {
                    num_cont[key]['next_num'] = 're';
                }
                if (t.isUnaryExpression(pop.right)) {
                    num_cont[key]['next_num'] = 'un';
                }
            }
        }
        //console.log("while1 success")
    }
    // 使用 regx2 匹配代码中的赋值语句并提取数字
    while (res = regx2.exec(code)) {
        let key1 = +res[2];
        if (num_cont[key1]) {
            num_cont[key1]["num"]++;  // 如果已存在，增加计数
            num_cont[key1]["side"] = true;  // 设置 side 为 true
        } else {
            num_cont[key1] = { "num": 1, 'red': get_code(res[2]), 'side': true };  // 否则创建新条目
            let pop1 = num_cont[key1]['red'].pop();
            if (t.isNumericLiteral(pop1.right)) {
                num_cont[key1]['next_num'] = pop1.right.value + "";
            } else {
                num_cont[key1]['red'].push(pop1);
                num_cont[key1]['next_num'] = -1;
                if (t.isReturnStatement(pop1)) {
                    num_cont[key1]['next_num'] = 're';
                }
                if (t.isUnaryExpression(pop1.right)) {
                    num_cont[key1]['next_num'] = 'un';
                }
            }
        }

     // 如果存在第二个匹配项 (regx2 匹配的第二个组)
        let key2 = +res[3];
        if (num_cont[key2]) {
            num_cont[key2]["num"]++;
            num_cont[key2]["side"] = true;
        } else {
            num_cont[key2] = { "num": 1, 'red': get_code(res[3]), 'side': true };
            let pop2 = num_cont[key2]['red'].pop();
            if (t.isNumericLiteral(pop2.right)) {
                num_cont[key2]['next_num'] = pop2.right.value + "";
            } else {
                num_cont[key2]['red'].push(pop2);
                num_cont[key2]['next_num'] = -1;
                if (t.isReturnStatement(pop2)) {
                    num_cont[key2]['next_num'] = 're';
                }
                if (t.isUnaryExpression(pop2.right)) {
                    num_cont[key2]['next_num'] = 'un';
                }
            }

        }
        //console.log("while2 success")
    }
    return num_cont;
}


function delete_num(co, co_judge, al, al_judge, num_key, num_cont, new_num_cont) {
    // 如果 co_judge 为真，处理 co
    if (co_judge) {
        // 删除 num_cont 和 new_num_cont 中对应 co 的条目
        delete num_cont[co];
        delete new_num_cont[co];

        // 找到 num_key 中 co 的索引并删除
        let index = num_key.indexOf(String(co));
        if (index !== -1) {
            num_key.splice(index, 1);
        }
    }

    // 如果 al_judge 为真，处理 al
    if (al_judge) {
        // 删除 num_cont 和 new_num_cont 中对应 al 的条目
        delete num_cont[al];
        delete new_num_cont[al];

        // 找到 num_key 中 al 的索引并删除
        let index = num_key.indexOf(String(al));
        if (index !== -1) {
            num_key.splice(index, 1);
        }
    }

    // 返回更新后的 num_cont, new_num_cont 和 num_key
    return [num_cont, new_num_cont, num_key];
}


function map_statement(arr) {
    return arr.map(function (value) {
        if (t.isBreakStatement(value)) return value;
        if (t.isExpressionStatement(value)) return value;
        if (t.isVariableDeclaration(value)) return value;
        if (t.isIfStatement(value)) return value;
        if (t.isSwitchStatement(value)) return value;
        if (t.isWhileStatement(value)) return value;
        if (t.isReturnStatement(value)) return value;
        if (t.isBlockStatement(value)) return value;
        if (t.isTryStatement(value)) return value;
        if (t.isContinueStatement(value)) return value;

        // 将其他类型的值包装为 ExpressionStatement
        return t.expressionStatement(value);
    });
}


/*特殊情况(嵌套)
* 两种情况：
一是嵌套（即其中一个分支指向的下一个控制流是 -1）
二是其中一个分支中的下一个是 un 或者 re 的
*/
function coNestCo(
    red,
    code_test,
    value,
    code1,
    code2,
    num,
    num2,
    num_cont,
    new_num_cont,
    num_key
) {
    let end_code = code1.pop();  // 获取 code1 中的最后一个元素
    let { test, consequent, alternate } = end_code.right;  // 解构赋值，获取 test、consequent 和 alternate
    let co = consequent.value;  // 获取 co 的值
    let al = alternate.value;  // 获取 al 的值
    // 获取 co 和 al 对应的代码块
    let co_code = num_cont[co];
    if (!co_code) co_code = new_num_cont[co];  // 如果 num_cont 中没有 co，则从 new_num_cont 中获取
    let al_code = num_cont[al];
    if (!al_code) al_code = new_num_cont[al];  // 如果 num_cont 中没有 al，则从 new_num_cont 中获取
    // 获取 co 和 al 的相关信息
    let co_next = co_code['next_num'];
    let co_red = co_code['red'];
    let co_num = co_code['num'];
    let al_next = al_code['next_num'];
    let al_red = al_code['red'];
    let al_num = al_code['num'];
    let sta, next_num, co_judge, al_judge, minus_num;
    // 特殊情况 1: 处理 co_next 和 al_next 的匹配
    if (co_next === num2 && al_next === value) {
        console.log("co_next === num2 && al_next === value")// 相关操作
    }
    if (al_next === num2 && co_next === value) {
        console.log("al_next === num2 && co_next === value")// 相关操作
    }
    // if else 处理
    if (
        co_next !== -1 &&
        co_next === al_next &&
        (co_next === num2 || co_next === num_cont[num2]['next_num'])
    ) {
        console.log("co_next !== -1 &&\n" +
            "        co_next === al_next &&\n" +
            "        (co_next === num2 || co_next === num_cont[num2]['next_num']")
        // 相关操作
    }
    // 处理特殊情况 2
    if (co === num2) {
        console.log("co === num2")
        // 相关操作
    }
    if (al === num2) {
        console.log("al === num2")
        // 相关操作
    }
    // 特殊情况 3: while 里面有 break
    if (!sta) {
        console.log("!sta")
        // 相关操作
    }
    if (!next_num) {
        console.log("!next_num")
        // 相关操作
    }
    // 从 num_key 中删除 num 的索引
    let index = num_key.indexOf(String(num));
    if (index !== -1) {
         console.log("index !== -1")
       //
    }
    // 调用 delete_num 函数删除 num 的相关信息
    [num_cont, new_num_cont, num_key] = delete_num(co, co_judge, al, al_judge, num_key, num_cont, new_num_cont);
    // 返回更新后的结果
    console.log("suceess conestco");
    return [red, next_num, num_cont, new_num_cont, num_key];
}

//主要还原方法！！！
function handle_conditional(red, value, test, co, al, num_cont, new_num_cont, num_key, end_code) {
    let co_code = num_cont[co];
    if (!co_code) co_code = new_num_cont[co];
    let al_code = num_cont[al]
    if (!al_code) al_code = new_num_cont[al];

    let co_next = co_code['next_num'];
    let co_red = co_code['red'];
    let co_num = co_code['num'];
    let al_next = al_code['next_num'];
    let al_red = al_code['red'];
    let al_num = al_code['num'];
    let sta, next_num, co_judge, al_judge;
    //while/while true
    if (value === co_next) {
        num_cont[value]['num']--;
        co_judge = true;
        if (red.length !== 0) {
            let ifSta = t.ifStatement(t.unaryExpression('!', test), t.blockStatement([t.breakStatement()]));
            red.push(ifSta);
            red = red.concat(co_red);
            let sta = t.whileStatement(t.booleanLiteral(true), t.blockStatement(map_statement(red)));
            red = [sta];
        } else {
            sta = t.whileStatement(test, t.blockStatement(map_statement(co_red)));
            red.push(sta);
        }
        if (al_num < 2) {
            al_judge = true;
            red = red.concat(al_red);
            next_num = al_next;
        } else {
            next_num = al;
        }
    }
    if (value === al_next) {
        num_cont[value]['num']--;
        al_judge = true;
        if (red.length !== 0) {
            // 创建一个条件语句，如果条件不满足，则直接中断
            let ifSta = t.ifStatement(
                t.unaryExpression('!', test),
                t.blockStatement([t.breakStatement()])
            );
            red.push(ifSta);  // 将该条件语句添加到 red 数组
            red = red.concat(al_red);  // 拼接 al_red 数组
            let sta = t.whileStatement(
                t.booleanLiteral(true),
                t.blockStatement(map_statement(red))
            );
            red = [sta];  // 将 red 更新为 while 语句数组
        } else {
            // 如果 red 数组为空，则直接使用 al_red 构建循环
            let sta = t.whileStatement(
                test,
                t.blockStatement(map_statement(al_red))
            );
            red.push(sta);
        }
        // 如果 co_num 小于 2，则进入特殊处理
        if (co_num < 2) {
            co_judge = true;
            red = red.concat(co_red);  // 拼接 co_red 数组
            next_num = co_next;        // 切换到 co_next
        } else {
            next_num = co;             // 切换到 co
        }
    }
    //if 还原
    if (co_next === al) {
        co_judge = true;   // 设置 co_judge 状态为 true
        // 创建一个 if 语句，条件是 test，执行 co_red 的操作集合
        sta = t.ifStatement(test, t.blockStatement(map_statement(co_red)));
        red.push(sta);  // 将 if 语句加入 red
        // 检查 al_num 的值
        if (al_num < 3) {
            al_judge = true;  // 设置 al_judge 状态为 true
            // 将 al_red 的操作集合拼接到 red
            red = red.concat(al_red);
            // 更新 next_num 为 al_next
            next_num = al_next;
        } else {
            // 如果 num_cont 中存在 al，减少其计数
            if (num_cont[al]) {
                num_cont[al]['num']--;
            } else {
                // 否则初始化计数器并减少计数
                new_num_cont[al]['num']--;
                // 更新 next_num 为 al
                next_num = al;
            }
        }
    }
    if (al_next === co) {
        al_judge = true;  // 设置 al_judge 状态为 true

        // 创建一个 if 语句，条件是 test，执行 al_red 的操作集合
        let sta = t.ifStatement(
            test,
            t.blockStatement(map_statement(al_red))
        );
        red.push(sta);  // 将 if 语句加入 red

        // 检查 co_num 的值
        if (co_num < 3) {
            co_judge = true;  // 设置 co_judge 状态为 true
            // 将 co_red 的操作集合拼接到 red
            red = red.concat(co_red);
            // 更新 next_num 为 co_next
            next_num = co_next;
        } else {
            // 如果 num_cont 中存在 co，减少其计数
            if (num_cont[co]) {
                num_cont[co]['num']--;
            } else {
                // 否则初始化计数器并减少计数
                new_num_cont[co]['num']--;
                // 更新 next_num 为 co
                next_num = co;
            }
        }
    }
    //if else 还原
    if (co_next !== -1 && co_next === al_next) {
        co_judge = true;
        // 如果 al_num 小于 2，则设置 al_judge 为 true
        if (al_num < 2) {
            al_judge = true;
        }
        // 创建一个 if 语句，根据 test 条件执行 co_red 和 al_red
        let sta = t.ifStatement(
            test,
            t.blockStatement(map_statement(co_red)),
            t.blockStatement(map_statement(al_red))
        );
        red.push(sta);
        // 如果 co_judge 和 al_judge 都为 true
        if (al_judge && co_judge) {
            // 获取 al_next 对应的代码段
            let code = num_cont[al_next];
            if (!code) {
                code = new_num_cont[al_next];
            }
            // 如果有相关代码，进行处理
            if (code['num']<3) {
                red = red.concat(code['red']); // 将 code['red'] 结果合并到 red
                next_num = code['next_num'];  // 更新 next_num
                // 删除 al_next 在 num_cont 和 new_num_cont 中的记录
                delete num_cont[al_next];
                delete new_num_cont[al_next];
                // 从 num_key 中删除 al_next
                let index = num_key.indexOf(al_next+'');
                if (index !== -1) {
                    num_key.splice(index, 1);
                }
            }else {
            // 如果 co_judge 或 al_judge 不满足条件，减少 al_next 或 new_num_cont 中的计数
            if (num_cont[al_next]) {
                num_cont[al_next]['num']--;
            } else {
                new_num_cont[al_next]['num']--;
            }
            next_num = al_next;
        }
    } else {
        // 如果 co_next 与 al_next 不匹配，直接减少 al 的计数
        num_cont[al]['num']--;
        next_num = al_next;
    }
}
    //嵌套还原
    if (!sta) {
        if (co_next === -1) {
        // 调用 coNestCo 函数处理 co 的逻辑
        [red, co_next, num_cont, new_num_cont, num_key] = coNestCo(
            red,
            test,
            value,
            co_red,
            al_red,
            co,
            al,
            num_cont,
            new_num_cont,
            num_key
        );
        // 如果 num_cont 中没有 co，直接返回当前状态
        if (!num_cont[co]) {
            return [red, co_next, num_cont, new_num_cont, num_key];
        }
    }
        if (al_next === -1) {
            // 调用 coNestCo 函数处理 al 的逻辑
            [red, al_next, num_cont, new_num_cont, num_key] = coNestCo(
                red,
                t.unaryExpression('!', test), // 使用否定的 test 作为条件
                value,
                al_red,
                co_red,
                al,
                co,
                num_cont,
                new_num_cont,
                num_key
            );
        // 如果 num_cont 中没有 al，直接返回当前状态
        if (!num_cont[al]) {
            return [red, al_next, num_cont, new_num_cont, num_key];
        }
    }
        if (!sta && (co_next === 're' || co_next === 'un')) {
             if (al_next === 're') {
                // 检查 al_num 是否小于 2
                if (al_num < 2) {
                    al_judge = true;
                    // 创建 ifStatement：对 al_red 执行逻辑
                    sta = t.ifStatement(t.unaryExpression('!', test), t.blockStatement(map_statement(al_red)));
                    red.push(sta); // 将生成的 sta 推入 red
                    // 检查 co_num 是否小于 2
                    if (co_num < 2) {
                        co_judge = true;
                        red = red.concat(co_red); // 合并 co_red
                        next_num = co_next;
                        // 特殊处理 next_num 为 'un' 的情况
                        if (next_num === 'un') {
                            red.pop(); // 从 red 中移除最后一个元素
                        }
                    } else {
                        next_num = co; // 设置 next_num 为 co
                    }
                }
            } else if (co_num < 2) {
                // co_num 小于 2 的逻辑
                co_judge = true;
                // 创建 ifStatement：对 co_red 执行逻辑
                sta = t.ifStatement(test, t.blockStatement(map_statement(co_red))
                );
                red.push(sta); // 将生成的 sta 推入 red
                // 检查 al_num 是否小于 2
                if (al_num < 2) {
                    al_judge = true;
                    red = red.concat(al_red); // 合并 al_red
                    next_num = al_next;
                    // 特殊处理 next_num 为 'un' 的情况
                    if (next_num === 'un') {
                        red.pop(); // 从 red 中移除最后一个元素
                    }
                } else {
                    next_num = al; // 设置 next_num 为 al
                }
            }
       }
        if (!sta){
            red.push(end_code);
            return  [red,-1,num_cont,new_num_cont,num_key];
        }
    }
    // 删除相关节点
    [num_cont, new_num_cont, num_key] = delete_num(co, co_judge, al, al_judge, num_key, num_cont, new_num_cont);
    //console .log("success handle_conditional")
    return [red, next_num, num_cont, new_num_cont, num_key];
}


/*判断是否含有下一个 next_num，next_num 中的 num 是否为 1，为 1 就代表只调用过一次，可以直接合并
存在于 num_cont 里：
    获取下一个控制流的对象
    取出这个对象的 代码块数组，进行合并
    之后将这个数字在 num_key 中删除掉
    最后将当前控制流对象的 next_num 替换成 next_num 对象里的 next_num
存在于 new_num_cont 里：
    从 new_num_cont 里取出对象后，只需要删除 new_num_cont 里对应的对象就好，因为只要存储在 new_num_cont 里，num_key 就不会含有存在 new_num_cont 里的 key
    操作和上面一样
最后跳到下一个循环
*/
function merge_ones_node(num_cont){
    let new_num_cont={};
    let num_key=Object.keys(num_cont);
    //console.log(num_key);
    while(true){
        if(num_key.length===0) break;
        let value=num_key.pop()
        let {red,next_num,num}=num_cont[value];
        while(true){
            if((num_cont[next_num]&&num_cont[next_num]['num']===1) ||
                (new_num_cont[next_num]&&new_num_cont[next_num]['num']===1)){
                if(num_cont[next_num]){
                   let dic=num_cont[next_num];
                   let arry=dic['red'];
                   red=red.concat(arry);
                   let index=num_key.indexOf(next_num+'');
                   if(index!==-1){
                       delete num_cont[next_num];
                       num_key.splice(index,1);
                   }
                   next_num=dic['next_num'];
                   continue;
                }
                if(new_num_cont[next_num]){
                    let dic=new_num_cont[next_num];
                    delete  new_num_cont[next_num];
                   let arry=dic['red'];
                   next_num=dic['next_num'];
                   red=red.concat(arry);
                   continue;
                }
            }
            new_num_cont[value]={'red':red,'next_num':next_num,"num":num};
            if(num_cont[value]['slide']) new_num_cont[value]['slide']=true;
            delete num_cont[value];
            break;
        }
    }
    return new_num_cont;
}


function merge_nodes(num_cont) {
    let new_num_cont = {};
    let num_key = Object.keys(num_cont);

    while (true) {
        let number = 0;
        if(num_key.length===0) break;
        let value = num_key[0];
        num_key.splice(0, 1);
        let { red, next_num, num } = num_cont[value];
        //console.log(generateCode(num_cont));
        while (true) {
            if (next_num === 'un') {
                new_num_cont[value] = { 'red': red, 'next_num': next_num, 'num': num_cont[value]['num'] };
                if (num_cont[value]['side']) {
                    new_num_cont[value]['side'] = true;
                }
                delete num_cont[value];
                break;
            }
            if (next_num === 're') {
                new_num_cont[value] = { 'red': red, 'next_num': next_num, 'num': num_cont[value]['num'] };
                if (num_cont[value]['side']) {
                    new_num_cont[value]['side'] = true;
                }
                delete num_cont[value];
                break;
            }
            if (next_num !== -1) {
                let code = num_cont[next_num] || new_num_cont[next_num];
                if (code['num'] < 2 && number === 0) {
                    delete num_cont[next_num];
                    delete new_num_cont[next_num];

                    let index = num_key.indexOf(next_num + '');
                    if (index !== -1) num_key.splice(index, 1);

                    red = red.concat(code['red']);
                    next_num = code['next_num'];
                    num_cont[value]['next_num'] = next_num;
                    continue;
                } else {
                    num_key.push(value);
                    num_cont[value]['red'] = red;
                    num_cont[value]['next_num'] = next_num;
                    break;
                }
            }
            let end_code=red.pop();
            //console.log(generate(end_code).code)
            let {test,consequent,alternate}=end_code.right;
            [red,next_num,num_cont,new_num_cont,num_key]=handle_conditional(red,value,test,consequent.value+"",alternate.value+"",num_cont,new_num_cont,num_key,end_code);
            if (next_num === -1) {
                num_cont[value]['red'] = red;
                num_key.push(value);
                break;
            }
            if (num_cont[next_num] && num_cont[next_num]['num'] > 1) {
                num_cont[value]['next_num'] = next_num;
                num_cont[value]['red'] = red;
                num_key.push(value);
                break;
            }
            number++;
        }
    }

    return Object.values(new_num_cont)[0]['red'];
}


//打印numb_cont
function generateCode(numCont) {
  // 创建代码块容器
  let codeSegments = [];

  // 遍历所有控制流节点
  Object.entries(numCont).forEach(([key,  { red, next_num }]) => {
    // 生成当前节点代码
    const blockCode = red.map(node  =>
      generator(node).code.replace(/;$/,  '')
    ).join(';\n');

    // 构建跳转逻辑
    let controlFlow = '';
    if (next_num === 're') {
      controlFlow = 'return;';
    } else if (next_num !== -1) {
      controlFlow = `goto(${next_num}); // 自定义跳转函数`;
    }

    // 组装代码块
    codeSegments.push(` 
      // 控制流节点 ${key}
      function block_${key}() {
        ${blockCode}
        ${controlFlow}
      }
    `);
  });

  return codeSegments.join('\n');
}



function gen_for_refduction(init_name,path,if_name){
    case_save(path,init_name)
    //printCasesAsJSCode(srcdir)
    let numb_cont=BlockAssociatedNumber(init_name,path)
    //let {red,next_num,num}=numb_cont["0"];
    numb_cont=merge_ones_node(numb_cont)
    //console.log(generateCode(numb_cont));
    let red_code=merge_nodes(numb_cont);
    return red_code;
}

function fix(path) {
    const node = path.node;

    if (t.isExpressionStatement(node) && t.isSequenceExpression(node.expression)) {
        const seqs = node.expression.expressions;

        switch (path.parentPath.type) {
            case 'SwitchCase': {
                let consequent = path.parentPath.node.consequent;
                const currentIndex = consequent.findIndex((stmt) => stmt === node);

                if (currentIndex !== -1) {
                    const newStatements = seqs.map((expr) => {
                        if (t.isVariableDeclaration(expr)) {
                            return expr; // 保留变量声明
                        }
                        if (
                            t.isAssignmentExpression(expr) ||
                            t.isCallExpression(expr) ||
                            t.isBinaryExpression(expr) ||
                            t.isExpression(expr)
                        ) {
                            return t.expressionStatement(expr); // 转为 ExpressionStatement
                        }
                        console.warn('未处理的表达式类型:', expr.type);
                        return null; // 未处理的类型返回 null
                    }).filter(Boolean); // 过滤掉空值

                    // 替换当前节点
                    consequent.splice(currentIndex, 1, ...newStatements);
                }
                break;
            }

            default:
                console.warn('不支持的父节点类型:', path.parentPath.type);
        }

        // 延迟删除，避免破坏遍历
        path.skip();
    }
}

const traverse_forexpress = {
    ExpressionStatement(path) {
        fix(path);
    },
};

const Start={
    ForStatement(path){
       let init_name=path.node.init.declarations[0].id.name;
       let body=path.node.body.body;

        body=body.at(-2).declarations[2];
       numbers=generate(body.init).code.match(/\d+/g)[0];
       let if_name=body.id.name;
       let num_cont=gen_for_refduction(init_name,path,if_name)
        path.replaceInline(map_statement(num_cont))
    }
};


function  MergeOne(ast){
    traverse(ast,traverse_forexpress);
    traverse(ast,Start)
}

function MergeOne1(bodyPath) {
  // 阶段式处理（自动继承作用域）
  const processingSteps = [traverse_forexpress, Start];

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
function Func_MergeOne(ast) {
  traverse(ast, {
    FunctionDeclaration(path) {
      if (!t.isBlockStatement(path.parent))  return;

      // 创建上下文保留的克隆体
      const clonedBody = t.cloneNode(path.node.body,  true);

      // 生成合法路径对象
      const newBodyPath = path.get('body').replaceWith(clonedBody)[0];

      // 传递完整路径上下文
      MergeOne1(newBodyPath);
    }
  });
}

module.exports = {
    MergeOne,
    Func_MergeOne
};
