#### 软件环境

1. nvm    0.39.7
2. pm2    5.3.1
3. node    18.15.0
4. nginx    1.24.0

#### 运行

1. 进入server
2. `npm install`安装依赖
3. `node signal-server.js`启动服务器
4. 使用nginx代理client

#### 说明

`adapter-8.2.3.js`用于兼容不同浏览器，用法详见(https://github.com/webrtcHacks/adapter)