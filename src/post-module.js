import Document from 'tuberia-core';
import MetaWeblogApi from './metaweblog-api';

class MetaWeblogPostModule {
  constructor(editFn, optsLocator) {
    this.editFn = editFn || function () {
      return false;
    };
    this.optsLocator = optsLocator || function () {
      return {};
    }
  }

  execute(docs, ctx) {
    if (!this.api) {
      let opts = this.optsLocator(ctx);
      this.api = new MetaWeblogApi(opts);
    }
    return Promise.all(docs.map(doc => {
      let shouldEdit = this.editFn.call(null, doc, ctx);
      let apiFn = shouldEdit ? 'editPost' : 'newPost';
      let post = doc.cloneMeta().meta.post;
      post.description = doc.content;
      return this.api[apiFn](post).then(res => {
        if (!shouldEdit && (res || res === '0')) {
          doc.meta.post.postid = res;
        }
        doc.meta.isNew = !shouldEdit;
        return doc;
      });
    }));
  }
}

export default function metaweblogPost(idField = 'postid', optsField = 'apiOptions') {
  let editFn = idField;
  let optsLocator = optsField;
  if (typeof idField === 'string') {
    editFn = (d) => !!d.meta.post[idField];
  }
  if (typeof optsField === 'string') {
    optsLocator = (c) => c[optsField];
  }
  return new MetaWeblogPostModule(editFn, optsLocator);
}