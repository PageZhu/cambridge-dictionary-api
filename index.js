const data = require("./data");  // 引入你的数据文件或字典查询函数

// 函数计算所需的入口函数
exports.handler = async function (event, context) {
    // 根据不同的请求路径处理不同的逻辑
    if (event.path === "/api/dictionary/english/hello") {
        // 如果请求的是字典查询路径，返回字典数据
        const response = data.english("hello");  // 假设 data.english 函数处理字典查询
        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };
    }

    // 根路径处理，返回一些简单的 UI 信息
    if (event.path === "/") {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "API is working! Try /api/dictionary/english/hello for dictionary lookup.",
            }),
        };
    }

    // 如果路径没有匹配到，返回 404 错误
    return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
    };
};
