/**
 * Javascript Upload Helper
 * 
 * Inspired by:
 * http://github.com/23/resumable.js
 * http://www.dropzonejs.com/
 * https://css-tricks.com/drag-and-drop-file-uploading/
 * 
 * MIT Licensed
 * Falk Müller, code@falk-m.de
 */

(function(){
"use strict";

  var jUpload = function(opts){
        if ( !(this instanceof jUpload) ) {
          return new jUpload(opts);
        }

        var me = this;
        me.files = [];
        me.defaults = {
            target: "",
            params: {},
            upload_field: "#uploadField",
            filezone: "#filezone",
            check_file: function(file){ return true;},
            upload_on_submit: "", //form-identifire
            chunk_size: 3 * 1024 * 1024, /*bytes: 1MB = 1024 * 1024 */
            is_init: false,
            abort: false
        };
        
        me.opts =  $.extend({}, me.defaults, opts);
        
        var support_upload = function(){
            return ((typeof(File)!=='undefined')
                   &&
                   (typeof(Blob)!=='undefined')
                   &&
                   (typeof(FileReader)!=='undefined')
                   &&
                   (typeof(FileList)!=='undefined')
                   &&
                   (!!Blob.prototype.webkitSlice||!!Blob.prototype.mozSlice||!!Blob.prototype.slice||false)
                   );
        }
        
        var support_drop = function() {
            var div = document.createElement('div');
            return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div));
        };  
        
        me.events = [];
        me.on = function(event,callback){
          me.events.push(event.toLowerCase(), callback);
        };
        me.fire = function(){
          var args = [];
          for (var i=0; i<arguments.length; i++) args.push(arguments[i]);
          var event = args[0].toLowerCase();
          for (var i=0; i<=me.events.length; i+=2) {
            if(me.events[i]==event) me.events[i+1].apply(me,args.slice(1));
          }
        };

        me.init = function(){
            if(!support_upload()){
                me.fire("unaviable");
                return;
            }
            
            var filezone = $(me.opts.filezone);
            var upload_field =  $(me.opts.upload_field);

            //init click event
            upload_field.hide();
            filezone.show();
            filezone.click(function(){
                upload_field[0].style.opacity = 0;
                upload_field[0].style.display='block';
                upload_field[0].focus();
                upload_field[0].click();
                upload_field[0].style.display='none';
            });
            
            upload_field.change(function(e){
                me.addFiles(e.target.files);
            });
            
            if(me.opts.upload_on_submit){
                $(me.opts.upload_on_submit).submit(function(){
                    setTimeout(function(){
                        me.upload();
                    },0);
                    return false;
                });
            }
            
            me.fire("aviable");
            
            //init drop
            if(support_drop()){
              me.fire("drop_aviable");
              filezone.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
              })
              .on('dragover dragenter', function() {
                filezone.addClass('is-dragover');
              })
              .on('dragleave dragend drop', function() {
                filezone.removeClass('is-dragover');
              })
              .on('drop', function(e) {
                    if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.items) {
                        me.addFiles(e.originalEvent.dataTransfer.items);
                    }
                    else if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files) {
                        me.addFiles(e.originalEvent.dataTransfer.files);
                    } 
                
              });
            } else {
                me.fire("drop_unaviable");
            }
            
            me.opts.is_init = true;
            return true;
          }
          
        me.addFiles = function(files){
            var entry, item, i, ii;
            for (i = 0, ii = files.length; i < ii; i++) {
              item = files[i];
              if ((item.webkitGetAsEntry != null) && (entry = item.webkitGetAsEntry())) {
                if (entry.isFile) {
                   me.addFile(item.getAsFile());
                } else if (entry.isDirectory) {
                  processDirectory(entry, entry.name);
                }
              } else if (item.getAsFile != null) {
                if ((item.kind == null) || item.kind === 'file') {
                   me.addFile(item.getAsFile());
                }
              } else if(item instanceof File) {
                  me.addFile(item);
              }
            }
        }
        
        var processDirectory = function (directory, path) {
            var dirReader, readEntries;

            dirReader = directory.createReader();

            readEntries = (function() {
              return function() {
                return dirReader.readEntries(function(entries) {
                  var entry, i;
                  if (entries.length > 0) {
                    for (i = 0; i < entries.length; i++) {
                      entry = entries[i];
                      if (entry.isFile) {
                        entry.file(function(file) {
                          file.relativePath = '/' + path + '/' + file.name;
                          me.addFile(file, event);
                        }, function() { // Error
                          
                        });
                      } else if (entry.isDirectory) {
                        processDirectory(entry, path + '/' + entry.name);
                      }
                    }
                    readEntries();
                  }
                  return null;
                });
              };
            })(this);

            return readEntries();
          };
        
        me.addFile = function(file){
            me.fire("addFile_before", file);
            
            var uniqueName = file.fileName||file.name;
            for (var i = 0; i < me.files.length; i++) {
                if(me.files[i].uniqueName == uniqueName){
                    var p = (Math.random().toString(16)+"000000000").substr(2,8);
                    uniqueName = p + '_' + uniqueName;
                }
            }
            
            var ufile = new uploadFile(me, file, uniqueName);
            
            if(me.opts.check_file(ufile)){
                me.files.push(ufile);
                me.fire("addedFile", ufile);
            }          
        }
        
        me.removeFile = function(uniqueName){
            var index = -1;
            for (var i = 0; i < me.files.length; i++) {
                if(me.files[i].uniqueName == uniqueName){
                   index = i;
                   break;
                }
            }
            if(index >= 0){
                var removed = me.files.splice(index, 1);
                me.fire("removedFiles", removed);
                return true;
            }
            
            return false;
        }
        
        me.upload = function(){
            me.fire("upload_before");
            
            if(me.opts.abort){
                return;
            }
 
            for (var i = 0; i < me.files.length; i++) {
                if(!me.files[i].complete_send){
                    setTimeout(me.files[i].upload,0);
                    me.fire("upload_start_file", me.files[i]);
                    return;
                }
            }

            me.fire("upload_end");
        }
        
        me.onProgress = function(uniqueName, p){
            var bype_ges = 0;
            var byte_send = 0;
            
            for (var i = 0; i < me.files.length; i++) {
                bype_ges += me.files[i].size;
                if(me.files[i].complete_send){
                   byte_send += me.files[i].size;
                } else if(me.files[i].uniqueName == uniqueName){
                   byte_send += (me.files[i].size * p); 
                }
            }
            
            me.fire("prozess", bype_ges, byte_send);
        }
        
        function uploadFile(jupload, file, uniqueName){
            var me = this;
            me.file = file;
            me.fileName = file.fileName||file.name;
            me.size = file.size;
            me.uniqueName = uniqueName;
            me.relativePath = file.relativePath || file.webkitRelativePath || file.fileName;
            
            var xhr = null,
            chunk_parts = 0;
            me.complete_send = false;
            var retry_count = 0;
            
            me.upload = function(){
                chunk_parts = Math.ceil(me.size / jupload.opts.chunk_size);
                setTimeout(function(){me.upload_chunk(0)},0);
            }      
            
            me.onSuccess = function(){
                me.complete_send = true;
                jupload.fire("file_uploaded", me);
                jupload.upload();
            }
            
            me.onProgress = function(p){
                jupload.fire("file_prozess", me, p);
                jupload.onProgress(me.uniqueName, p);
            }
            
            me.upload_chunk = function(current_chunk){
                
                var fileObj = me.file;
                var startByte = current_chunk * jupload.opts.chunk_size;
                var endByte = startByte + jupload.opts.chunk_size;

                var func   = (fileObj.slice ? 'slice' : (fileObj.mozSlice ? 'mozSlice' : (fileObj.webkitSlice ? 'webkitSlice' : 'slice')));
                var bytes  = fileObj[func](startByte,endByte);

                var data = new FormData();
                data.append("file", bytes);
                
                //other data
                data.append("chunk",current_chunk + 1);
                data.append("total_chunk", chunk_parts);
                data.append("uniqueName",me.uniqueName);
                data.append("fileName",me.fileName);
                data.append("size",me.size);
                
                for (var key in jupload.opts.params) {
                    data.append(key,jupload.opts.params[key]);
                }
               
                
                //sending
                xhr = new XMLHttpRequest();

                xhr.upload.onprogress = function(d){
                        var p = (1 / chunk_parts) * (d.loaded / d.total);
                        var p_ges = current_chunk/chunk_parts;
                        me.onProgress((p_ges + p));
                   };

                xhr.onerror = function(){
                   console.log("onerror");
                },

                xhr.onabort = function(){
                    console.log("onabort");
                }

                xhr.onreadystatechange = function() {
                    if(xhr.readyState == 4 && xhr.status == 200) {
                            var res = null;
                            try {
                                res = JSON.parse(xhr.response)
                            } catch (e) { res = xhr.response;}
                           
                           jupload.fire("file_upload_response", me, current_chunk, res);
                           
                           if(jupload.opts.abort){
                                    return;
                           }
                           
                            if(current_chunk + 1 < chunk_parts) {
                               var p_ges = (current_chunk + 1)/chunk_parts;
                               me.onProgress(p_ges);
                               setTimeout(function(){me.upload_chunk(current_chunk + 1)},0);
                           } else {
                                me.onProgress(1);
                                me.onSuccess();
                           }
                        } else if (xhr.readyState > 4 && xhr.status != 200) {
                            console.log(xhr.readyState);
                            console.log(xhr.status);
                            return;
                             retry_count++;
                            if(retry_count < 10){
                                setTimeout(function(){
                                console.log("retry");    
                                me.upload_chunk(current_chunk)
                                }, 1000);
                            } else {
                                 console.log("end retry");    
                            }
                        }
                    }

                xhr.open("POST", jupload.opts.target, true);
                xhr.send(data);
            }
        }
        
  };

     window.jUpload = jUpload;
})();