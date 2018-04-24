var express = require('express');
var app = express();
var router = express.Router();
var request = require('request');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var db = require('../config/db');

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
    if(req.body.data){
        // console.log(req.body.data);
        const email=req.body.data;
        let sql = "select * from user";
        sql += ' where email = \'' + email + '\'';
        db.query(sql, function (err, rows) {
            if (err) {
                console.error(err);
            } else {
                // console.log(rows);
                if (rows.length==0){
                    res.json(true);
                }else{
                    res.json(false);
                }
            }
        });
    }
});


module.exports = router;
