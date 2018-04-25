function sendCaptcha(email, captcha) {
    // load nodemailer as follows
    // npm install nodemailer --save
    var nodemailer = require('nodemailer');
    // create reusable transporter object using SMTP transport
    var transporter = nodemailer.createTransport({
        "host": "smtpdm.aliyun.com",
        "port": 25,
        "secureConnection": true, // use SSL
        "auth": {
            "user": 'sinpo96@wxb-wy.com', // user name
            "pass": '1996WEIxinbo'         // password
        }
    });
    var mailOptions = {
        from: 'Sinpo<sinpo96@wxb-wy.com>', // sender address mailfrom must be same with the user
        to: email, // list of receivers
        // cc: 'haha<xxx@xxx.com>', // copy for receivers
        // bcc: 'haha<xxxx@xxxx.com>', // secret copy for receivers
        subject: 'Circle注册验证码', // Subject line
        // text: '-----', // plaintext body
        html: "您的注册验证码是 <span style='color: coral'>" + captcha + "</span> ！", // html body
        // attachments: [
        //     {
        //         filename: 'text0.txt',
        //         content: 'hello world!'
        //     },
        //     {
        //         filename: 'text1.txt',
        //         path: './app.js'
        //     }, {
        //         filename: 'test.JPG',
        //         path: './Desert.jpg',
        //         cid: '01'
        //     }
        // ],
    };
    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            return console.log(error);
        }
        // console.log('Message sent: ' + info.response);
    });
}

exports.sendCaptcha = sendCaptcha;

