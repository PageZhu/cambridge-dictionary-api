const { handler } = require("./index"); // 假设你的 index.js 文件在同一目录下
const { handler2 } = require("./index-data"); // 假设你的 index.js 文件在同一目录下

const event = {
    path: "/us/dictionary/english/example", // 修改为你要测试的 URL 路径
};

const context = {}; // 可以为空

handler(event, context)
    .then((response) => {
        console.log("Response:", response);
    })
    .catch((error) => {
        console.error("Error:", error);
    });

    
handler2(event, context)
.then((response) => {
    console.log("Response:", response);
})
.catch((error) => {
    console.error("Error:", error);
});

const http = require("http");
const data = require("./data");
const port = process.env.PORT || 3000;
const server = http.createServer(data);

server.listen(port);