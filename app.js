var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');


var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
    next();
});

let userObject = {};
var io = app.io = require("socket.io")();
io.on("connection", function (socket) {
    socket.on('email',(email)=>{
        if (!userObject[email]) {
            userObject[email]={email:email,socketid:socket.id};
            // 发送广播给出自己以外的所有用户，通知已登录
            socket.broadcast.emit('newLogin',email);
            console.log("A user connected");
            console.log(userObject);
        }
    });
    // 用户退出
    socket.on('logout', (email)=>{
        if (userObject[email]) {
            delete userObject[email];
            console.log(userObject);
        }
        console.log('user disconnected');
    });
    // 发送广播
    app.post('/api/broadcast',function (req,res) {
        const broadcastText = req.body.text;
        io.sockets.emit('broadcast',broadcastText);
        console.log('发送广播成功');
    });
    // 检查用户是否在线
    socket.on('checkUserOnline',(email)=>{
        if (userObject[email]) {
            // 用户在线
            io.sockets.connected[socket.id].emit('checkUserOnlineReturn', true);
        }else {
            io.sockets.connected[socket.id].emit('checkUserOnlineReturn', false);
        }
    });

    //私聊：服务器接受到私聊信息，发送给目标用户
    socket.on('private_message', function (from,to,msg) {
        if (userObject[to]) {
            console.log('emitting private message by ', from, ' say to ',to, msg);
            io.sockets.connected[userObject[to].socketid].emit("pmsg",from,msg);
        }

    });

    socket.on('newDiary',(me,followedme)=>{
        for (let i=0;i<followedme.split(',').length;i++) {
            if (userObject[followedme.split(',')[i]]) {
                io.sockets.connected[userObject[followedme.split(',')[i]].socketid].emit("remindNewDiary",me);
                console.log(me,'发送了新的日记',followedme.split(',')[i],'接收信号');
            }
        }

    });

    // socket.emit('alluser',userObject);
    socket.emit('successlogin','连接成功');

    socket.on('disconnect', () => console.log('网页已关闭或者刷新，连接断开'));
});



module.exports = app;
