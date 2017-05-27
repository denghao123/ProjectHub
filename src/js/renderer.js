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
    children: []
  },
  mounted() {
    var _this = this;

    this.getAllData();

    // error caught
    process.on('uncaughtException', function(error) {
      _this.displayProcess("[error caught]" + this.gbk(error), 'error');
    });

  },

  methods: {

    /*
     *get localStorage data
     */
    getAllData() {
      this.appData = JSON.parse(localStorage.getItem("data")) || {
        list: []
      };
    },

    onDrag(e) {
      drag = false;
      localStorage.setItem("data", JSON.stringify(this.appData));
    },

    /*
     * get real path
     */
    getFilePath(e) {
      for (var f of e.target.files) {
        this.formData.filePath = f.path;
      }
    },

    openFolder(path) {
      cp.exec('explorer ' + path);
      this.displayProcess('open folder: ' + path, 'done');
    },

    task(id, path, command) {
      var _this = this;
      var cmd = "cd/d " + path + "&&" + command;
      var child = cp.exec(cmd, {
        encoding: "binary"
      });

      child.stdout.on('data', (data) => {
        _this.displayProcess(data);
      })

      child.stderr.on('data', (data) => {
        _this.displayProcess(data, 'error', 'gb2312');
      })

      child.on('exit', (code) => {
        _this.displayProcess("======= done! =======", 'done');
      });

      // save pid
      for (var v of this.appData.list) {
        if (v.id === id) {
          this.children.push({
            id: id,
            pid: child.pid
          })
        }
      }

    },

    // close process
    close(id) {
      var c = this.children;
      for (var i in c) {
        if (c[i].id === id) {
          this.taskKill(c[i].pid);
          delete c[i];
          return;
        }
      }
      // if not found the id:
      this.displayProcess("[ The process is not running !]", 'error');
    },

    taskKill(pid) {
      var _this = this;
      if (!pid) {
        _this.displayProcess('sorry! process pid missed.', 'error');
        return;
      }

      var cmd = 'taskkill /PID ' + pid + ' /T /F';
      var child = cp.exec(cmd, {
        encoding: "binary"
      })

      child.on('exit', (code) => {
        _this.displayProcess("[ process killed! ]", 'done');
      });

    },

    // display result
    displayProcess(str, type, char) {
      this.scrollToBottom();
      var s = str.toString();
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

    // copy project
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

    // delete project
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
     *open modify window
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

    // DIY cmd
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

    // delete diy cmd
    delOtherCmd(index) {
      var cmds = this.formData.otherCommand;
      cmds.splice(index, 1);
    },

    /*
     *save modify
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

    openCmd() {
      cp.exec("start cmd /k");
      this.displayProcess("start cmd", 'done');
    },

    clearProcessInfo() {
      this.processData = '';
    },

    /*
     * clone object
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


    cancelModify() {
      this.toggleShow();
    },

    // open url in brower
    openWebUrl(url) {
      shell.openExternal(url);
    },

    gbk(str, char) {
      return iconv.decode(new Buffer(str, 'binary'), char || 'utf-8');
    },

    scrollToBottom() {
      var b = document.getElementById('bottomLine');
      b.scrollIntoView();
    },

    /*
     * Toast
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