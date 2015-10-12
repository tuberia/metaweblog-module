import { MetaWeblog } from './ext/metaweblog';

let adapt = function (res, rej) {
  return function (err, data) {
    if (err) {
      rej(err);
    } else {
      res(data);
    }
  };
};

export default class MetaWeblogApi {
  constructor(opts) {
    this.username = opts.username || '';
    this.password = opts.password || '';
    this.blogId = opts.blogId || '';
    delete opts.username;
    delete opts.password;
    delete opts.blogId;
    this.api = new MetaWeblog(opts.url, opts);
    this.appKey = opts.appKey || '';
  }

  getUserBlogs() {
    return new Promise((res, rej) => {
      this.api.getUserBlogs(this.appKey, this.username, this.password, adapt(res, rej));
    });
  }

  newPost(post, publish = true) {
    return new Promise((res, rej) => {
      this.api.newPost(this.blogId, this.username, this.password, post, publish, adapt(res, rej));
    });
  }

  editPost(post, publish = true) {
    if (!post.postid) {
      return Promise.reject('No postid in the post to edit');
    }
    return new Promise((res, rej) => {
      this.api.editPost(post.postid, this.username, this.password, post, publish, adapt(res, rej));
    });
  }
}