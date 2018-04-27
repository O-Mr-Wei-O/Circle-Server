var express = require('express');
var app = express();
var router = express.Router();
var request = require('request');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var db = require('../config/db');
var captcha = require('../config/sendCaptcha');
const formidable = require('formidable');


var co = require('co');
var OSS = require('ali-oss');
var fs = require("fs");
var client = new OSS({
    region: 'oss-cn-beijing',
    accessKeyId: 'LTAI7wlX2c74LiOo',
    accessKeySecret: 'yQCDa7x7HUjpR3ezzJX39LIVI9sto4',
    bucket: 'graduationdesign'
});


//获取不同type的新闻
router.get('/api/top_News/:type', function (req, res) {
    // console.log(req.params.type);
    request('http://api.jisuapi.com/news/get?channel=' + encodeURI(req.params.type) + '&start=0&num=20&appkey=21e41c8472f9add0', function (error, response, body) {
        res.json(body);
    });
    // res.json({a:'a'});
});


//验证邮箱是否已经存在(false表示存在，true表示不存在，可以注册)
router.post('/api/validate', function (req, res) {
    if (req.body.data) {
        // console.log(req.body.data);
        const email = req.body.data;
        let sql = "select * from user";
        sql += ' where email = \'' + email + '\'';
        db.query(sql, function (err, rows) {
            if (err) {
                console.error(err);
            } else {
                // console.log(rows);
                if (rows.length == 0) {
                    res.json(true);
                } else {
                    res.json(false);
                }
            }
        });
    }
});

// 发送验证码
router.post('/api/captcha', function (req, res) {
    // 阿里云只能进行国内的推送，不然显示连接超时
    if (req.body.data) {
        const email = req.body.data;
        // 生成随机6位验证码
        const captchaCode = Math.random().toString(36).substr(7);
        captcha.sendCaptcha(email, captchaCode);
        // console.log(captchaCode);
        res.json(captchaCode);
    }
});

// 注册
router.post('/api/register', function (req, res) {
    if (req.body.data) {
        // console.log(req.body.data);
        const email = req.body.data.email;
        const password = req.body.data.password;
        const nickname = req.body.data.nickname;
        //用户表注册
        db.query('insert into user(email,password,nickname) values(\'' + email + '\',\'' + password + '\',\'' + nickname + '\')', function (err, rows) {
            if (err) {
                console.error(err);
                res.json('fail');
            } else {
                // console.log(rows);
                // 生成个人信息（在表personalInfo里面）
                db.query('insert into personalInfo(avatar,nickname,sex,birthday,email) values(null,\'' + nickname + '\',1,null,\'' + email + '\')', function (err, rows) {
                    if (err) {
                        console.error(err);
                    } else {
                        // console.log(rows);
                    }
                });
                res.json('success');
            }
        });

    }
});

//登录
router.post('/api/login', function (req, res) {
    if (req.body.data) {
        // console.log(req.body.data);
        const email = req.body.data.email;
        const password = req.body.data.password;
        let sql = 'select * from user';
        sql += ' where email = \'' + email + '\'';
        db.query(sql, function (err, rows) {
            if (err) {
                console.error('查询失败：' + err);
            } else {
                if (rows.length != 0) {
                    //返回的数组先转化为json字符串
                    const rowsString = JSON.stringify(rows);
                    // JSON字符串转换为JSON对象
                    const rowsObject = JSON.parse(rowsString);
                    // console.log(rowsObject[0].password);
                    if (rowsObject[0].password == password) {
                        db.query('select * from admin where email = \'' + email + '\'', function (err, rows) {
                            if (rows.length != 0) {
                                res.json({
                                    login: 'loginSuccess',
                                    nickname: rowsObject[0].nickname,
                                    email: email,
                                    // admin中1表示是管理员账户，0表示不是管理员
                                    admin: 1
                                });
                            } else if (rows.length == 0) {
                                res.json({
                                    login: 'loginSuccess',
                                    nickname: rowsObject[0].nickname,
                                    email: email,
                                    // admin中1表示是管理员账户，0表示不是管理员
                                    admin: 0
                                });
                            }
                        });
                    } else {
                        res.json({login: 'loginFail', nickname: null, email: null});
                    }
                } else {
                    res.json({login: 'loginFail', nickname: null, email: null});
                }
            }
        });
    }
    // res.end();
});

router.post('/api/getPersonalInfo', function (req, res) {
    if (req.body.data) {
        const email = req.body.data;
        db.query('select * from personalinfo where email = \'' + email + '\'', function (err, rows) {
            // console.log( rows);
            if (rows.length != 0) {
                res.json({
                    avatar: rows[0].avatar,
                    nickname: rows[0].nickname,
                    sex: rows[0].sex,
                    birthday: rows[0].birthday
                });
            } else {
                res.json({});
            }
        });
    }
});


// 上传头像
router.post('/api/uploadAvatar/:email', function (req, res) {
    // console.log(req.params.email);
    const email = req.params.email;
    // 跨域
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");

    let form = new formidable.IncomingForm();
    form.encoding = 'utf-8'; // 编码
    form.keepExtensions = true; // 保留扩展名
    form.maxFieldsSize = 2 * 1024 * 1024; // 文件大小
    form.uploadDir = './public/images';  // 存储路径
    form.parse(req, function (err, fileds, files) { // 解析 formData数据
        if (err) {
            return console.log(err)
        }
        // console.log(files);
        // 这里的avatar是前台的组件里name
        let imgPath = files.avatar.path; // 获取文件路径
        let imgName = files.avatar.name; // 文件原名
        // oss上传文件开始
        co(function* () {
            var stream = fs.createReadStream(imgPath);
            var result = yield client.putStream(imgName, stream);
            // console.log(result);
            if (result.res.status == 200) {
                // 将外链地址存入与email对应的数据库
                // console.log(result.res.requestUrls[0]);
                let sql = "update personalinfo set avatar = '" + result.res.requestUrls[0] + "' where email = '" + email + "'";
                // console.log(sql);
                db.query(sql, function (err, rows) {
                    if (err) {
                        res.send("修改头像失败 " + err);
                    } else {
                        res.end();
                    }
                });
            }
        });
        // 上传结束
        fs.unlink(imgPath, function () {
        });// 删除文件，不保存
    })
});


//修改个人信息
router.post('/api/updatePersonalInfo/:type', function (req, res) {
    // console.log(req.body.data);
    // 种类
    const type = req.params.type;
    // 值
    const value = req.body.data;
    //email
    const email = req.body.email;
    let sql = "update personalinfo set " + type + "= '" + value + "' where email = '" + email + "'";
    // console.log(sql);
    db.query(sql, function (err, rows) {
        if (err) {
            res.send("修改个人信息失败 " + err);
        } else {
            if (type == 'nickname') {
                let sql = "update user set nickname = '" + value + "' where email = '" + email + "'";
                // console.log(sql);
                db.query(sql, function (err, rows) {
                    if (err) {
                        res.send("修改nickname失败 " + err);
                    }
                });
            }
            res.end();
        }
    });

});
module.exports = router;
