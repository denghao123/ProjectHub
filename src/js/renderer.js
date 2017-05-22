var cp = require('child_process');
var iconv = require('iconv-lite');
var vm = new Vue({
  el: "#app",
  data: {
    appData: {
      list: []
    },
    currData: {},
    formData: {
      id: '',
      title: '',
      filePath: '',
      cmd_dev: '',
      cmd_build: ''
    },
    processData: '',
    input_cmd: '',
    showModify: false,
    chirdren: {}
  },
  mounted() {
    let _this = this;
    this.getAllData();

    process.on('uncaughtException', function(error) {
      _this.displayProcess(error, 'error');
    });
  },

  methods: {

    /*
     *获取全部数据
     */
    getAllData() {
      this.appData = JSON.parse(localStorage.getItem("data")) || {
        list: []
      };
    },

    /*
     *选择项目地址
     */
    getFilePath(e) {
      for (var f of e.target.files) {
        this.formData.filePath = f.path;
      }
    },

    /*
     *执行cmd
     */
    task(id, way) {
      var _this = this;
      var cmd = "";
      var filePath = "";
      var list = this.appData.list;
      if (!id) {
        cmd = this.input_cmd;
      } else {
        for (var i in list) {
          if (id === list[i].id) {
            cmd = "cd/d " + list[i].filePath + "&&" + list[i][way];
          }
        }
      }

      // eg:  'start cmd /k "cd/d f:\\project\\AI-chat&&gulp"';
      this.chirdren = cp.exec(cmd, {
        encoding: "binary"
      });

      _this.chirdren.stdout.on('data', (data) => {
        console.log('ok')
        _this.displayProcess(data);
      })

      _this.chirdren.stderr.on('data', (data) => {
        console.log('error')
        _this.displayProcess(data, 'error');
      })

      _this.chirdren.on('exit', (code) => {
        _this.displayProcess("======= done! =======", 'done');
      });

    },

    // 关闭进程
    close(id) {
      var _this = this;
      console.log(_this.chirdren.pid);

      if (!_this.chirdren.pid) {
        _this.displayProcess('sorry! process pid missed.', 'error');
        return;
      }

      let cmd = 'taskkill /PID ' + _this.chirdren.pid + ' /T /F';

      cp.exec(cmd, function(error, stdout, stderr) {
        if (stdout) _this.displayProcess("[process closed!]", 'done');
        if (stderr) _this.displayProcess(stderr, 'error');
        if (error) _this.displayProcess(error, 'error');
      });

    },

    // 展示结果
    displayProcess(str, type) {
      this.scrollToBottom();
      let s = str.toString();
      switch (type) {
        case 'error':
          this.processData += '<div class="c-red">' + this.gbk(s) + '</div>';
          break;
        case 'done':
          this.processData += '<div class="c-green">' + this.gbk(s) + '</div>';
          break;
        default:
          this.processData += this.gbk(s) + '<br>';
          break;
      }
    },

    // 删除item
    del(id) {
      if (!id) return;
      var list = this.appData.list;
      for (var i in list) {
        if (id === list[i].id) {
          list.splice(i, 1);
        }
      }
      localStorage.setItem("data", JSON.stringify(this.appData));
    },


    /*
     *打开modify弹窗
     */
    openModify(id) {
      if (id) {
        var list = this.appData.list;
        for (var i in list) {
          if (id === list[i].id) {
            this.currData = list[i];
            this.formData = this.copy(this.currData);
          }
        }
      } else {
        this.formData = {
          id: '',
          title: '',
          filePath: '',
          cmd_dev: '',
          cmd_build: ''
        }
      }
      this.toggleShow();
    },

    /*
     *保存modify
     */
    saveModify(id) {

      if (!this.formData.title) {
        this.toast("项目名称必填！");
        return;
      }

      var list = this.appData.list;
      if (id) {
        for (var i in list) {
          if (id === list[i].id) {
            list[i] = this.formData;
          }
        }
      } else {
        this.formData.id = Date.parse(new Date()) / 1000;
        list.push(this.formData);
      }

      this.currData = this.formData;
      this.toggleShow();
      localStorage.setItem("data", JSON.stringify(this.appData));
    },

    toggleShow() {
      this.showModify = !this.showModify;
    },


    /*
     *克隆对象
     */
    copy(obj) {
      var r = {};
      for (var key in obj) {
        r[key] = typeof obj[key] === 'object' ? this.copy(obj[key]) : obj[key];
      }
      return r;
    },

    /*
     *取消modify
     */
    cancelModify() {
      this.toggleShow();
    },

    /*
     *中文乱码问题
     */
    gbk(str) {
      return iconv.decode(new Buffer(str, 'binary'), 'gbk');
    },

    /*
     *保持底部可见
     */
    scrollToBottom() {
      var b = document.getElementById('bottomLine');
      b.scrollIntoView();
    },

    /*
     * Toast 提示框
     */
    toast(msg, callback, time) {
      if (!document.getElementById('js-toast')) {
        var box = document.createElement("div"),
          span = document.createElement("span"),
          txt = document.createTextNode(msg);
        box.id = "js-toast";
        span.id = "js-toast-msg";
        box.className = "js-toast";
        span.appendChild(txt);
        box.appendChild(span);
        document.body.appendChild(box);
      }

      if (box.addEventListener) {
        box.addEventListener("touchmove", function(e) {
          e.preventDefault();
        })
      } else {
        box.attachEvent("ontouchmove", function(e) {
          window.event.returnValue = false;
        })
      }
      setTimeout(function() {
        document.body.removeChild(box);
        typeof callback === "function" && callback();
      }, (time ? time : 1500));
    }

  }
});