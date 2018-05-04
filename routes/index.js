var express = require('express');
var app = express();
var router = express.Router();
var request = require('request');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var db = require('../config/db');
var captcha = require('../config/sendCaptcha');
var moment = require('moment');
const formidable = require('formidable');


// oss存储
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
        console.log(captchaCode);
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
        const defaultAvatar = 'https://graduationdesign.oss-cn-beijing.aliyuncs.com/%E4%BA%91%E6%9C%B5%E5%A4%B4%E5%83%8F.jpeg';
        //用户表注册
        db.query('insert into user(email,password,nickname) values(\'' + email + '\',\'' + password + '\',\'' + nickname + '\')', function (err, rows) {
            if (err) {
                console.error(err);
                res.json('fail');
            } else {
                // console.log(rows);
                // 生成个人信息（在表personalinfo里面）
                db.query('insert into personalinfo(avatar,nickname,sex,birthday,email) values(\'' + defaultAvatar + '\',\'' + nickname + '\',1,null,\'' + email + '\')', function (err, rows) {
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
        let sql = 'select * from (SELECT user.*,userbaned.userid as banid FROM socialweb.user left join userbaned on  user.id=userbaned.userid order by id) as t';
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
                    // true表示被封禁，false表示未被封禁
                    const banid = rowsObject[0].banid ? true : false;
                    // console.log(banid);
                    // console.log(rowsObject[0].password);
                    if (rowsObject[0].password == password) {
                        db.query('select * from admin where email = \'' + email + '\'', function (err, rows) {
                            if (rows.length != 0) {
                                if (banid == true) {
                                    res.json({
                                        login: 'baned',
                                        nickname: rowsObject[0].nickname,
                                        email: email,
                                        // admin中1表示是管理员账户，0表示不是管理员
                                        admin: 1
                                    });
                                } else if (banid == false) {
                                    res.json({
                                        login: 'loginSuccess',
                                        nickname: rowsObject[0].nickname,
                                        email: email,
                                        // admin中1表示是管理员账户，0表示不是管理员
                                        admin: 1
                                    });
                                }
                            } else if (rows.length == 0) {
                                if (banid == true) {
                                    res.json({
                                        login: 'baned',
                                        nickname: rowsObject[0].nickname,
                                        email: email,
                                        // admin中1表示是管理员账户，0表示不是管理员
                                        admin: 0
                                    });
                                } else if (banid == false) {
                                    res.json({
                                        login: 'loginSuccess',
                                        nickname: rowsObject[0].nickname,
                                        email: email,
                                        // admin中1表示是管理员账户，0表示不是管理员
                                        admin: 0
                                    });
                                }
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

// 获取个人信息
router.post('/api/getPersonalInfo', function (req, res) {
    if (req.body.data) {
        const email = req.body.data;
        db.query('select personalinfo.*,userfollow.ifollowemail,userfollow.followedme from (personalinfo left join userfollow on personalinfo.email=userfollow.email) where personalinfo.email = \'' + email + '\'', function (err, rows) {
            // console.log( rows);
            if (rows.length != 0) {
                res.json({
                    avatar: rows[0].avatar,
                    nickname: rows[0].nickname,
                    sex: rows[0].sex,
                    birthday: rows[0].birthday,
                    ifollowemail: rows[0].ifollowemail,
                    followedme: rows[0].followedme
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

// 上传文件接口
router.post('/api/upload', function (req, res) {
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
        let imgPath = files.file.path; // 获取文件路径
        let imgName = files.file.name; // 文件原名
        // oss上传文件开始
        co(function* () {
            var stream = fs.createReadStream(imgPath);
            var result = yield client.putStream(imgName, stream);
            // console.log(result);
            // 返回文件外链地址
            res.json(result.res.requestUrls[0]);
        });
        // 上传结束
        fs.unlink(imgPath, function () {
        });// 删除文件，不保存
    })
});

// 写日记接口
router.post('/api/diary', function (req, res) {
    // console.log('-----');
    const email = req.body.email;
    const title = req.body.title;
    const content = req.body.content;
    const pic = req.body.pic;
    // moment(1124995030449).toObject()使用这个分解为对象
    const nowtime = moment().valueOf();
    db.query('insert into diary(email,title,content,pic,createtime) values(\'' + email + '\',\'' + title + '\',\'' + content + '\',\'' + pic + '\',\'' + nowtime + '\')', function (err, rows) {
        if (err) {
            console.error(err);
            res.json(false);
        } else {
            console.log(rows);
            res.json(true);
        }
    });
});

// 日记——谁关注了我
router.post('/api/diarywhofollow', function (req, res) {
    db.query('SELECT * FROM socialweb.userfollow where userfollow.email = \'' + req.body.email + '\'', function (err, rows) {
        if (err) {
            console.error(err);
        }else {
            let whoFollow = '';
            if (rows.length!=0) {
                whoFollow = rows[0].followedme ? rows[0].followedme : '';
            }
            res.json(whoFollow);
        }
    });
});

// 获取圈子信息
router.post('/api/circle', function (req, res) {
    // left join on左表查询方式，通过diary.id这种方式选择需要的字段留下来，如果选择*，则会有重复字段
    db.query('SELECT diary.id as diaryid,diary.email as email,title,content,pic,createtime,nickname,avatar,number,who,reporter FROM socialweb.diary left join personalinfo on personalinfo.email=diary.email left join diaryzan on diary.id=diaryzan.diaryid left join diaryreport on diaryreport.diaryid=diary.id order by diaryid;', function (err, rows) {
        if (rows.length != 0) {
            // console.log(rows);
            // res.end();

            // 剔除被封禁的日记
            db.query('select * from diarybaned', function (err, rows5) {
                if (err) {
                    console.error(err);
                } else {
                    // console.log(rows5);
                    let rowsSelect = [];
                    let rows5Array = [];
                    if (rows5.length != 0) {
                        // 将rows5的id放入数组以便进行比较
                        for (let i = 0; i < rows5.length; i++) {
                            rows5Array.push(rows5[i].diaryid);
                        }

                        // 将日记筛选后放入新数组
                        for (let i = 0; i < rows.length; i++) {
                            if (rows5Array.indexOf(rows[i].diaryid.toString()) == -1) {
                                rowsSelect.push(rows[i]);
                            }
                        }
                        // console.log(rowsSelect);
                    } else {
                        rowsSelect = rows;
                    }

                    db.query('SELECT comment.id as commentid, diaryid,comment.email as email,pid,replyid,comment,createtime,avatar,nickname FROM socialweb.comment left join personalinfo on personalinfo.email=comment.email order by comment.id;', function (err, rows1) {
                        if (rows1.length != 0) {
                            // console.log(rows);
                            db.query('SELECT comment.id as commentid, diaryid,comment.email as email,pid,replyid,comment,createtime,avatar,nickname FROM socialweb.comment left join personalinfo on personalinfo.email=comment.email where pid !=0 and replyid !=0 order by comment.id;', function (err, rows2) {
                                if (rows2.length != 0) {
                                    for (let i = 0; i < rows1.length; i++) {
                                        let obj = new Object();
                                        let replydata = [];
                                        for (let j = 0; j < rows2.length; j++) {
                                            if (rows1[i].commentid == rows2[j].pid) {
                                                replydata.push(rows2[j]);
                                            }
                                        }
                                        obj.data = replydata;
                                        rows1[i].reply = obj.data;
                                    }
                                    db.query('select diarycollect.*,userfollow.followedme from (diarycollect left join userfollow on diarycollect.email=userfollow.email) where diarycollect.email=\'' + req.body.email + '\'', function (err, rows3) {
                                        if (rows3.length != 0) {
                                            // console.log(rowsSelect);
                                            res.json({
                                                diary: rowsSelect,
                                                comment: rows1,
                                                collectDiary: rows3[0].diaryid,
                                                followedme: rows3[0].followedme
                                            });
                                        } else {
                                            res.json({diary: rowsSelect, comment: rows1, collectDiary: ''});
                                        }
                                    });
                                    // console.log({diary: rows, comment: rows1});
                                } else {
                                    res.json({diary: rowsSelect, comment: []});
                                }
                            });
                        }
                    });
                }
            });


        } else {
            res.json({});
        }
    });
});

// 评论
router.post('/api/comment', function (req, res) {
    // console.log(req.body);
    const {email, diaryid, pid, replyid, commentText} = req.body;
    const nowtime = moment().valueOf();
    db.query('insert into comment(email,diaryid,pid,replyid,comment,createtime) values(\'' + email + '\',\'' + diaryid + '\',\'' + pid + '\',\'' + replyid + '\',\'' + commentText + '\',\'' + nowtime + '\')', function (err, rows) {
        if (err) {
            console.error(err);
            res.json(false);
        } else {
            res.json(true);
        }
    });
});

// 点赞
router.post('/api/zan', function (req, res) {
    // console.log(req.body);
    let {diaryid, email, number, who} = req.body;
    // console.log(sql);
    db.query('select * from diaryzan where diaryid=' + diaryid, function (err, rows) {
        if (err) {
            res.send(err);
        } else {
            // console.log(rows);
            if (rows.length != 0) {
                // 已有数据的情况更新
                number++;
                let who = rows[0].who + ',' + email;
                db.query('update diaryzan set number=\'' + number + '\', who =\'' + who + '\' where diaryid =  \'' + diaryid + '\'', function (err, rows) {
                    if (err) {
                        console.error("点赞失败 " + err);
                    } else {
                        res.end();
                    }
                });
            } else {
                // 没有数据的情况插入
                number++;
                db.query('insert into diaryzan(diaryid,number,who) values(\'' + diaryid + '\',\'' + number + '\',\'' + email + '\')', function (err, rows) {
                    if (err) {
                        console.error("点赞失败 " + err);
                    } else {
                        res.end();
                    }
                });
            }

        }
    });
});

// 收藏
router.post('/api/collect', function (req, res) {
    // console.log(req.body);
    let {diaryid, email} = req.body;
    db.query('select * from diarycollect where email=\'' + email + '\'', function (err, rows) {
        if (err) {
            res.send(err);
        } else {
            console.log(rows);
            if (rows.length != 0) {
                // 已有数据的情况更新
                let diary = rows[0].diaryid + ',' + diaryid;
                console.log(diaryid);
                db.query('update diarycollect set diaryid=\'' + diary + '\' where email =  \'' + email + '\'', function (err, rows) {
                    if (err) {
                        console.error("点赞失败 " + err);
                    } else {
                        res.end();
                    }
                });
            } else {
                // 没有数据的情况插入
                db.query('insert into diarycollect(email,diaryid) values(\'' + email + '\',\'' + diaryid + '\')', function (err, rows) {
                    if (err) {
                        console.error("点赞失败 " + err);
                    } else {
                        res.end();
                    }
                });
            }

        }
    });
});

// 举报
router.post('/api/report', function (req, res) {
    let {diaryid, reporter} = req.body;
    db.query('select * from diaryreport where diaryid=\'' + diaryid + '\'', function (err, rows) {
        if (rows.length != 0) {
            // 已有数据的情况更新
            let reporterString = rows[0].reporter + ',' + reporter;
            db.query('update diaryreport set reporter=\'' + reporterString + '\' where diaryid =  \'' + diaryid + '\'', function (err, rows) {
                if (err) {
                    console.error("举报失败 " + err);
                } else {
                    res.end();
                }
            });
        } else {
            // 没有数据的情况插入
            db.query('insert into diaryreport(diaryid,reporter) values(\'' + diaryid + '\',\'' + reporter + '\')', function (err, rows) {
                if (err) {
                    console.error("举报失败 " + err);
                } else {
                    res.end();
                }
            });
        }
    });
});

// 获取举报的日记
router.post('/api/getreport', function (req, res) {
    db.query('select diaryid,reporter,title,content,pic,createtime,user.email,nickname,user.id as userid from (diaryreport left join diary on diaryreport.diaryid=diary.id) left join user on diary.email=user.email order by diaryid; ', function (err, rows) {
        // console.log(rows);
        let diary = [];
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].reporter.split(',').length > 1) {
                diary.push(rows[i]);
            }
        }
        res.json(diary);
    });
});

// 封禁用户和日记
router.post('/api/ban', function (req, res) {
    // console.log(req.body);
    const {diaryid, userid} = req.body;
    // 封禁日记
    db.query('insert into diarybaned(diaryid) values(\'' + diaryid + '\')', function (err, rows) {
        if (err) {
            console.error(err);
        } else {
            // 封禁用户
            db.query('insert into userbaned(userid) values(\'' + userid + '\')', function (err, rows) {
                if (err) {
                    console.error(err);
                } else {
                    // 删除diaryreport表中的相应数据，即已处理
                    db.query('delete from diaryreport where diaryid=\'' + diaryid + '\'', function (err, rows) {
                        if (err) {
                            console.error(err);
                        } else {
                            res.end();
                        }
                    });
                }
            });
        }
    });
});

// 申请解封（添加进数据库）        日记 确认违规不可解封！！！！！！！！
router.post('/api/unseal', function (req, res) {
    // console.log(req.body);
    const {email, reason} = req.body.data;
    db.query('select * from unseal where proposer=\'' + email + '\'', function (err, rows) {
        if (rows.length != 0) {
            // 已有数据的情况更新
            db.query('update unseal set reason=\'' + reason + '\' where proposer =  \'' + email + '\'', function (err, rows) {
                if (err) {
                    console.error("查询解封失败 " + err);
                } else {
                    res.end();
                }
            });
        } else {
            // 没有数据的情况插入
            db.query('insert into unseal(proposer,reason) values(\'' + email + '\',\'' + reason + '\')', function (err, rows) {
                if (err) {
                    console.error("插入解封数据失败 " + err);
                } else {
                    res.end();
                }
            });
        }
    });
});

// 获取解封申请信息
router.post('/api/getunseal', function (req, res) {
    db.query('SELECT * FROM socialweb.unseal;', function (err, rows) {
        if (err) {
            console.error(err);
        } else {
            res.json(rows);
        }
    });
});

// 解封
router.post('/api/approveunseal/:proposer', function (req, res) {
    const proposer = req.params.proposer;
    db.query('select user.id from unseal left join  user on unseal.proposer=user.email;', function (err, rows) {
        console.log(rows);
        if (rows.length != 0) {
            db.query('delete from userbaned where userid=\'' + rows[0].id + '\'', function (err, rows) {
                if (err) {
                    console.error(err);
                } else {
                    db.query('delete from unseal where proposer=\'' + proposer + '\'', function (err, rows) {
                        if (err) {
                            console.error(err);
                        } else {
                            res.end();

                        }
                    });
                }
            });
        }
    });
});


// 模糊搜索用户
router.post('/api/searchuserVague', function (req, res) {
    // console.log(req.body.email);
    if (req.body.email != '') {
        // console.log(req.body.value);
        db.query('SELECT user.id as userid,user.email,user.nickname,personalinfo.avatar,userfollow.ifollowemail,userfollow.followedme FROM (socialweb.user left join personalinfo on user.email=personalinfo.email left join userfollow on user.email=userfollow.email) where user.email like \'%' + req.body.value + '%\'  or  user.nickname like \'%' + req.body.value + '%\';', function (err, rows) {
            if (err) {
                console.error(err);
            } else {
                // console.log(rows);
                res.json(rows);
            }
        });
    }
});

// 精准匹配用户
router.post('/api/searchuserAccurate', function (req, res) {
    // console.log(req.body.email);
    if (req.body.email != '') {
        // console.log(req.body.value);
        db.query('SELECT user.id as userid,user.email,user.nickname,personalinfo.avatar,userfollow.ifollowemail,userfollow.followedme FROM (socialweb.user left join personalinfo on user.email=personalinfo.email left join userfollow on user.email=userfollow.email) where user.email = \'' + req.body.value + '\'  or  user.nickname = \'' + req.body.value + '\';', function (err, rows) {
            if (err) {
                console.error(err);
            } else {
                // console.log(rows);
                res.json(rows);
            }
        });
    }
});

// 关注某一用户（关注方式为email）
router.post('/api/follow', function (req, res) {
    // followdemail为要关注的email和myemail是我的email
    const {followdemail, myemail} = req.body;
    // console.log(followdemail, myemail);
    db.query('select * from userfollow where email=\'' + myemail + '\'', function (err, rows) {
        if (rows.length != 0) {
            // 已有我的数据的情况下更新
            let follow = rows[0].ifollowemail;
            if (follow == null) {
                follow = followdemail;
            } else {
                follow = follow + ',' + followdemail;
            }
            // 这一步添加进我的关注
            db.query('update userfollow set ifollowemail=\'' + follow + '\' where email =  \'' + myemail + '\'', function (err, rows1) {
                if (err) {
                    console.error("查询解封失败 " + err);
                } else {
                    // 这一步先查找我要关注的用户是否有记录，如果有就更新它的关注者，如果没有就新插入
                    db.query('select * from userfollow where email=\'' + followdemail + '\'', function (err, rows2) {
                        if (rows2.length != 0) {
                            // 已有数据的情况更新
                            // console.log(rows2);
                            let followedme = rows2[0].followedme;

                            if (followedme == null) {
                                followedme = myemail;
                            } else {
                                followedme = followedme + ',' + myemail;
                            }

                            db.query('update userfollow set followedme=\'' + followedme + '\' where email =  \'' + followdemail + '\'', function (err, rows3) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    res.end();
                                }
                            });
                        } else {
                            // 没有数据的情况插入
                            db.query('insert into userfollow(email,ifollowemail,followedme) values(\'' + followdemail + '\',null,\'' + myemail + '\')', function (err, row4) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    res.end();
                                }
                            });
                        }
                    });
                }
            });
        } else {
            // 没有数据的情况插入
            db.query('insert into userfollow(email,ifollowemail,followedme) values(\'' + myemail + '\',\'' + followdemail + '\',null)', function (err, rows5) {
                if (err) {
                    console.error(err);
                } else {
                    // 这一步先查找我要关注的用户是否有记录，如果有就更新它的关注者，如果没有就新插入
                    db.query('select * from userfollow where email=\'' + followdemail + '\'', function (err, rows6) {
                        if (rows.length != 0) {
                            // 已有数据的情况更新
                            let followedme = rows6[0].followedme;
                            if (followedme == null) {
                                followedme = myemail;
                            } else {
                                followedme = followedme + ',' + myemail;
                            }

                            db.query('update userfollow set followedme=\'' + followedme + '\' where email =  \'' + followdemail + '\'', function (err, rows7) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    res.end();
                                }
                            });
                        } else {
                            // 没有数据的情况插入
                            db.query('insert into userfollow(email,ifollowemail,followedme) values(\'' + followdemail + '\',null,\'' + myemail + '\')', function (err, row8) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    res.end();
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});


// 获取我关注的人列表（chat组件中）
router.post('/api/getiFollowed', function (req, res) {
    db.query('SELECT * FROM socialweb.userfollow where email=\'' + req.body.email + '\';', function (err, rows) {
        if (err) {
            console.error(err);
        } else {
            // console.log(rows);
            res.json(rows);
        }
    });
});
module.exports = router;
