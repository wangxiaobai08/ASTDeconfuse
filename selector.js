const fs = require('fs');
const path = require('path');

//-----------------------------------------
const modules = {};
//-----------------------------------------
//导入所有解混淆模块
function import_desrc(){
    //let i=0;
    // 读取指定目录中的文件
    const dirPath = './DeSrc'; // 目录路径
    // 使用 readdirSync 同步读取
    const files = fs.readdirSync(dirPath);
    // 如果要读取文件内容，可以进一步使用 fs.readFileSync
    files.forEach(file => {

        const filePath = path.join(dirPath, file); // 获取文件的完整路径
        const relativePath = `./${path.relative('./', filePath).replace(/\\/g, '/')}`;//相对路径
        const moduleregex = new RegExp('([\\w*]+)\\.js');
        const modulename = moduleregex.exec(relativePath);
        if (modulename && modulename[1]) {
            const moduleName = modulename[1];
            try {
                // 动态加载模块
                const module = require(relativePath);
                modules[moduleName] = module; // 将模块存储在 modules 对象中
                //console.log((i++)+` : ${moduleName}`);
            } catch (err) {
                console.error(`Failed to import module ${moduleName}:`, err);
            }
        }
    });
}

//选择模块
function selectmodule(moduletype){
    import_desrc();
    switch (moduletype){
        case 0:
            return modules["StringReversion"];
            break;
        case 1:
            return modules["TriExpToIf"];
        default:
            console.log("模块查询失败!")
            return null;
    }
}

// 使用 CommonJS 导出
module.exports = {
    selectmodule
};
