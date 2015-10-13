import Document from 'tuberia-core';
import MetaWeblogApi from './metaweblog-api';

class MetaWeblogGetBlogModule {
  constructor(optsLocator) {
    this.silent = false;
    this.optsLocator = optsLocator || function () {
      return {};
    }
  }

  failSilently() {
    this.silent = true;
    return this;
  }

  execute(docs, ctx) {
    if (!this.api) {
      let opts = this.optsLocator(ctx);
      this.api = new MetaWeblogApi(opts);
    }
    return Promise.all(docs.map(doc => {
      let getBlogs = this.api.getUserBlogs().then(res => {
        doc.meta.blogid = res.blogid;
        doc.meta.blogName = res.blogName;
        return doc;
      });
      return this.silent ? getBlogs.catch(() => {}) : getBlogs;
    }));
  }
}

export default function metaweblogGetBlog(optsField = 'apiOptions') {
  let optsLocator = optsField;
  if (typeof optsField === 'string') {
    optsLocator = (c) => c[optsField];
  }
  return new MetaWeblogGetBlogModule(optsLocator);
}