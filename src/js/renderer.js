var cp = require('child_process');
var iconv = require('iconv-lite');
var draggable = require('vuedraggable');
var {
  shell
} = require('electron');

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
      cmd_build: '',
      otherCommand: []
    },
    processData: '',
    input_cmd: '',
    showModify: false,
    chirdren: {}
  },
  mounted() {
    // 测试
    // let temp = {
    //   "list": [{
    //     "id": 1495525103,
    //     "title": "rrkd-static-h5",
    //     "filePath": "E:\\project\\rrkd-static-h5",
    //     "cmd_dev": "npm run dev",
    //     "cmd_build": "npm run build",
    //     "otherCommand": [{
    //       "name": '自定义1',
    //       "command": 'node -v'
    //     }, {
    //       "name": '自定义2',
    //       "command": 'npm -v'
    //     }]
    //   }]
    // }
    // localStorage.setItem("data", JSON.stringify(temp));

    let _this = this;
    this.getAllData();

    // error捕获
    process.on('uncaughtException', function(error) {
      _this.displayProcess("[error caught]" + this.gbk(error), 'error');
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

    //拖动换位
    onDrag(e) {
      drag = false;
      localStorage.setItem("data", JSON.stringify(this.appData));
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
     * 打开目录
     */
    openFolder(path) {
      cp.exec('explorer ' + path);
      this.displayProcess('open folder: ' + path, 'done');
    },

    /*
     *执行cmd
     */
    task(path, command) {
      var _this = this,
        cmd = "cd/d " + path + "&&" + command;

      // eg:  'start cmd /k "cd/d f:\\project\\AI-chat&&gulp"';
      this.chirdren = cp.exec(cmd, {
        encoding: "binary"
      });

      _this.chirdren.stdout.on('data', (data) => {
        _this.displayProcess(data);
      })

      _this.chirdren.stderr.on('data', (data) => {
        _this.displayProcess(data, 'error', 'gb2312');
      })

      _this.chirdren.on('exit', (code) => {
        _this.displayProcess("======= done! =======", 'done');
      });

    },

    // 关闭进程
    close(id) {
      var _this = this;

      if (!_this.chirdren.pid) {
        _this.displayProcess('sorry! process pid missed.', 'error');
        return;
      }

      let cmd = 'taskkill /PID ' + _this.chirdren.pid + ' /T /F';

      let child_close = cp.exec(cmd, {
        encoding: "binary"
      }, function(error, stdout, stderr) {
        if (stdout) _this.displayProcess("[process closed!]", 'done', 'gb2312');
        if (stderr) _this.displayProcess(stderr, 'error', 'gb2312');
      });
    },

    // 展示结果
    displayProcess(str, type, char) {
      this.scrollToBottom();
      let s = str.toString();
      switch (type) {
        case 'error':
          this.processData += '<div class="c-red">' + this.gbk(s, char) + '</div>';
          break;
        case 'done':
          this.processData += '<div class="c-green">' + this.gbk(s, char) + '</div>';
          break;
        default:
          this.processData += this.gbk(s, char) + '<br>';
          break;
      }
    },

    // 复制项目
    copy(id) {
      var list = this.appData.list;
      for (var i in list) {
        if (id === list[i].id) {
          var temp = this.clone(list[i]);
          temp.title = list[i].title + ".bak";
          temp.id = Date.parse(new Date()) / 1000;
          list.push(temp)
        }
      }
      localStorage.setItem("data", JSON.stringify(this.appData));
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
            this.formData = this.clone(this.currData);
          }
        }
      } else {
        this.formData = {
          id: '',
          title: '',
          filePath: '',
          cmd_dev: '',
          cmd_build: '',
          otherCommand: []
        }
      }
      this.toggleShow();
    },

    // 添加自定义cmd
    addOtherCmd() {
      var cmds = this.formData.otherCommand;

      if (cmds.length < 4) {
        cmds.push({
          name: "",
          command: ""
        })
      } else {
        this.toast("最多添加4条！");
      }
    },

    // 删除自宝义cmd
    delOtherCmd(index) {
      var cmds = this.formData.otherCommand;
      cmds.splice(index, 1);
    },

    /*
     *保存modify
     */
    saveModify(id) {
      // check
      var form = this.formCheck(this.formData);
      if (!form) return;

      var list = this.appData.list;

      if (id) {
        for (var i in list) {
          if (id === list[i].id) {
            list[i] = form;
          }
        }
      } else {
        form.id = Date.parse(new Date()) / 1000;
        list.push(form);
      }

      this.currData = form;
      this.toggleShow();
      localStorage.setItem("data", JSON.stringify(this.appData));
    },

    // form check
    formCheck(obj) {
      if (!obj.title) {
        this.toast("项目名称必填！");
        return;
      }

      if (!obj.filePath) {
        this.toast("项目路径必填！");
        return;
      }

      var cmdEmpty = obj.otherCommand.some(function(v, index, arr) {
        return !(v.name && v.command);
      })

      if (cmdEmpty) {
        this.toast("自定义指令填写不完整！");
        return;
      }

      return obj;
    },

    toggleShow() {
      this.showModify = !this.showModify;
    },

    // 新开cmd窗口
    openCmd() {
      cp.exec("start cmd /k");
      this.displayProcess("start cmd", 'done');
    },

    clearProcessInfo() {
      this.processData = '';
    },

    /*
     * 克隆对象
     */
    clone(obj) {
      var o;
      if (typeof obj == "object") {
        if (obj === null) {
          o = null;
        } else {
          if (obj instanceof Array) {
            o = [];
            for (var i = 0, len = obj.length; i < len; i++) {
              o.push(this.clone(obj[i]));
            }
          } else {
            o = {};
            for (var j in obj) {
              o[j] = this.clone(obj[j]);
            }
          }
        }
      } else {
        o = obj;
      }
      return o;
    },

    /*
     *取消modify
     */
    cancelModify() {
      this.toggleShow();
    },

    // 打开浏览器
    openWebUrl(url) {
      shell.openExternal(url);
    },

    /*
     *中文乱码问题
     */
    gbk(str, char) {
      return iconv.decode(new Buffer(str, 'binary'), char || 'utf-8');
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
      }, (time ? time : 1000));
    }
  },
  components: {
    draggable
  }
});