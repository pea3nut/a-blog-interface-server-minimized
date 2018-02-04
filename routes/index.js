"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const a_blog_interface_1 = require("a-blog-interface");
const Bluebird = require('bluebird');
const Toml2Json = require('toml').parse;
const Router = require('express').Router;
const Fs = Bluebird.promisifyAll(require('fs'));
const Path = require('path');
const TAG_FILE_PATH = Path.join(__dirname, '../data/tag/');
const POSTS_FILE_PATH = Path.join(__dirname, '../data/posts/');
const CATEGORY_FILE_PATH = Path.join(__dirname, '../data/category/');
const router = Router();
router.get('/posts/all', catchWith(getPostsAll));
router.get('/posts/:posts_id', catchWith(getPosts));
router.get('/tag/all', catchWith(getTagAll));
router.get('/tag/:tag_alias', catchWith(getTag));
router.get('/category/all', catchWith(getCategoryAll));
router.get('/category/:category_alias', catchWith(getCategory));
function catchWith(method) {
    return function (req, res, next) {
        method(req.params, req.query).then(data => {
            res.json(data);
        }, error => { throw error; });
    };
}
;
async function getPostsAll() {
    var files = (await Fs.readdirAsync(POSTS_FILE_PATH))
        .filter(fileName => /.toml$/.test(fileName));
    var postsList = [];
    for (let fileName of files) {
        let filePath = Path.join(POSTS_FILE_PATH, fileName);
        let fileContent = await Fs.readFileAsync(filePath);
        postsList.push(Toml2Json(fileContent));
    }
    ;
    return {
        errcode: 0,
        errmsg: 'ok',
        posts_length: postsList.length,
        posts_map: function (postsList) {
            var postMap = {};
            postsList.forEach(post => postMap[post.id.toString()] = post);
            return postMap;
        }(postsList),
    };
}
;
async function getPosts(params) {
    var postsId = params['posts_id'];
    if (await Promise.race([
        new Promise(resolve => {
            Fs.access(Path.join(POSTS_FILE_PATH, `${postsId}.toml`), Fs.constants.R_OK, (err) => err ? resolve(true) : resolve(false));
        }),
        new Promise(resolve => {
            Fs.access(Path.join(POSTS_FILE_PATH, `${postsId}.md`), Fs.constants.R_OK, (err) => err ? resolve(true) : resolve(false));
        }),
    ]))
        return {
            errcode: a_blog_interface_1.ResponseErrcode.PostsNotFound,
            errmsg: `Posts "${postsId}" is not exist.`
        };
    const infoFile = Path.join(POSTS_FILE_PATH, `${postsId}.toml`);
    const contentFile = Path.join(POSTS_FILE_PATH, `${postsId}.md`);
    var postsInfo = Toml2Json(await Fs.readFileAsync(infoFile));
    var postsContent = (await Fs.readFileAsync(contentFile)).toString();
    return {
        errcode: a_blog_interface_1.ResponseErrcode.Ok,
        errmsg: 'ok',
        ...postsInfo,
        //todo: generate description if description is empty
        md_content: postsContent,
    };
}
;
async function getTagAll() {
    var files = await Fs.readdirAsync(TAG_FILE_PATH);
    var tags = [];
    for (let fileName of files) {
        let filePath = Path.join(TAG_FILE_PATH, fileName);
        let fileContent = await Fs.readFileAsync(filePath);
        tags.push(Toml2Json(fileContent));
    }
    ;
    return {
        errcode: 0,
        errmsg: 'ok',
        tag_length: tags.length,
        tag_map: function (tags) {
            var tagMap = {};
            tags.forEach(tag => tagMap[tag.alias] = tag);
            return tagMap;
        }(tags),
    };
}
;
async function getTag(params) {
    var tagAlias = params['tag_alias'];
    if (await new Promise(resolve => {
        Fs.access(Path.join(TAG_FILE_PATH, `${tagAlias}.toml`), Fs.constants.R_OK, (err) => err ? resolve(true) : resolve(false));
    }))
        return {
            errcode: a_blog_interface_1.ResponseErrcode.TagNotFound,
            errmsg: `Tag "${tagAlias}" is not exist.`
        };
    var postsInfoFiles = (await Fs.readdirAsync(POSTS_FILE_PATH))
        .filter(fileName => /\.toml$/.test(fileName));
    var postsList = [];
    for (let fileName of postsInfoFiles) {
        let filePath = Path.join(POSTS_FILE_PATH, fileName);
        let postInfo = Toml2Json(await Fs.readFileAsync(filePath));
        if (postInfo.tag_list.includes(tagAlias)) {
            postsList.push(postInfo);
        }
    }
    ;
    return {
        errcode: a_blog_interface_1.ResponseErrcode.Ok,
        errmsg: 'ok',
        posts_length: postsList.length,
        posts_map: function (postsList) {
            var postsMap = {};
            postsList.forEach(posts => postsMap[posts.id.toString()] = posts);
            return postsMap;
        }(postsList),
    };
}
;
async function getCategoryAll() {
    var files = await Fs.readdirAsync(CATEGORY_FILE_PATH);
    var categories = [];
    for (let fileName of files) {
        let filePath = Path.join(CATEGORY_FILE_PATH, fileName);
        let fileContent = await Fs.readFileAsync(filePath);
        categories.push(Toml2Json(fileContent));
    }
    ;
    return {
        errcode: 0,
        errmsg: 'ok',
        category_length: categories.length,
        category_map: function (categories) {
            var tagMap = {};
            categories.forEach(category => tagMap[category.alias] = category);
            return tagMap;
        }(categories),
    };
}
;
async function getCategory(params) {
    var categoryMap = (await getCategoryAll()).category_map;
    var categoryAlias = params['category_alias'];
    if (await new Promise(resolve => {
        Fs.access(Path.join(CATEGORY_FILE_PATH, `${categoryAlias}.toml`), Fs.constants.R_OK, (err) => err ? resolve(true) : resolve(false));
    }))
        return {
            errcode: a_blog_interface_1.ResponseErrcode.CategoryNotFound,
            errmsg: `Category "${categoryAlias}" is not exist.`
        };
    var postsInfoFiles = (await Fs.readdirAsync(POSTS_FILE_PATH))
        .filter(fileName => /\.toml$/.test(fileName));
    var postsList = [];
    for (let fileName of postsInfoFiles) {
        let filePath = Path.join(POSTS_FILE_PATH, fileName);
        let postInfo = Toml2Json(await Fs.readFileAsync(filePath));
        let categoryStack = [categoryMap[categoryAlias]];
        while (true) {
            if (categoryStack.length === 0)
                break;
            let category = categoryStack.pop();
            if (postInfo.category_list.includes(category.alias)) {
                postsList.push(postInfo);
                break;
            }
            categoryStack.push(...category.child_alias_list.map(alias => categoryMap[alias]));
        }
        ;
    }
    ;
    return {
        errcode: a_blog_interface_1.ResponseErrcode.Ok,
        errmsg: 'ok',
        posts_length: postsList.length,
        posts_map: function (postsList) {
            var postsMap = {};
            postsList.forEach(posts => postsMap[posts.id.toString()] = posts);
            return postsMap;
        }(postsList),
    };
}
;
module.exports = router;
;
;
