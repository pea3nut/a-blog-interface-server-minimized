import {RequestHandler} from "express";
import {ApiErrorResponse, CategoryAlias, CategoryInfo, Get, IndexMap, PostsId, PostsInfoWithoutContent, ResponseErrcode, TagAlias, TagInfo, ToString} from "a-blog-interface";


const Bluebird = require('bluebird');
const Toml2Json =require('toml').parse;
const Router = require('express').Router;
const Fs = Bluebird.promisifyAll(require('fs'));
const Path = require('path');


const TAG_FILE_PATH =Path.join(__dirname,'../data/tag/');
const POSTS_FILE_PATH =Path.join(__dirname,'../data/posts/');
const CATEGORY_FILE_PATH =Path.join(__dirname,'../data/category/');


const router = Router();


router.get('/posts/all'      ,catchWith(getPostsAll));
router.get('/posts/:posts_id',catchWith(getPosts));
router.get('/tag/all'        ,catchWith(getTagAll));
router.get('/tag/:tag_alias' ,catchWith(getTag));
router.get('/category/all'   ,catchWith(getCategoryAll));
router.get('/category/:category_alias' ,catchWith(getCategory));

function catchWith<T>(
    method :(params:any,query:any)=>Promise<T>
):RequestHandler{
    return function(req,res,next){
        method(req.params,req.query).then(data=>{
            res.json(data);
        },error=>{throw error});
    };
};

async function getPostsAll():Promise<Get.posts.all.response>{
    var files =(<string[]>(await Fs.readdirAsync(POSTS_FILE_PATH)))
        .filter(fileName=>/.toml$/.test(fileName))
    ;
    var postsList:PostsInfoWithoutContent[] =[];
    for(let fileName of files){
        let filePath =Path.join(POSTS_FILE_PATH,fileName);
        let fileContent:string =await Fs.readFileAsync(filePath);
        postsList.push(Toml2Json(fileContent));
    };
    return {
        errcode :0,
        errmsg :'ok',
        posts_length :postsList.length,
        posts_map :function(postsList){
            var postMap:{[alias in ToString<PostsId>]:PostsInfoWithoutContent} ={};
            postsList.forEach(post=>postMap[post.id.toString()]=post);
            return postMap;
        }(postsList),
    };
};
async function getPosts(params:any):Promise<Get.posts.response|ApiErrorResponse>{
    var postsId:ToString<PostsId> =params['posts_id'];
    if(await Promise.race([
        new Promise(resolve=>{
            Fs.access(
                Path.join(POSTS_FILE_PATH ,`${postsId}.toml`),
                Fs.constants.R_OK,
                (err:NodeJS.ErrnoException)=>err?resolve(true):resolve(false)
            );
        }),
        new Promise(resolve=>{
            Fs.access(
                Path.join(POSTS_FILE_PATH ,`${postsId}.md`),
                Fs.constants.R_OK,
                (err:NodeJS.ErrnoException)=>err?resolve(true):resolve(false)
            );
        }),
    ])) return{
        errcode :ResponseErrcode.PostsNotFound,
        errmsg  :`Posts "${postsId}" is not exist.`
    };
    const infoFile =Path.join(POSTS_FILE_PATH,`${postsId}.toml`);
    const contentFile =Path.join(POSTS_FILE_PATH,`${postsId}.md`);

    var postsInfo:PostsInfoWithoutContent =Toml2Json(await Fs.readFileAsync(infoFile));
    var postsContent:string =(await Fs.readFileAsync(contentFile)).toString();
    return {
        errcode:ResponseErrcode.Ok,
        errmsg:'ok',
        ...postsInfo,
        //todo: generate description if description is empty
        md_content:postsContent,
    };
};
async function getTagAll():Promise<Get.tag.all.response>{
    var files:string[] =await Fs.readdirAsync(TAG_FILE_PATH);
    var tags:TagInfo[] =[];
    for(let fileName of files){
        let filePath =Path.join(TAG_FILE_PATH,fileName);
        let fileContent:string =await Fs.readFileAsync(filePath);
        tags.push(Toml2Json(fileContent));
    };
    return {
        errcode :0,
        errmsg :'ok',
        tag_length :tags.length,
        tag_map :function(tags){
            var tagMap:{[alias in TagAlias] :TagInfo} ={};
            tags.forEach(tag=>tagMap[tag.alias]=tag);
            return tagMap;
        }(tags),
    };
};
async function getTag(params:any):Promise<Get.tag.response|ApiErrorResponse>{
    var tagAlias:TagAlias =params['tag_alias'];
    if(await new Promise(resolve=>{
            Fs.access(
                Path.join(TAG_FILE_PATH ,`${tagAlias}.toml`),
                Fs.constants.R_OK,
                (err:NodeJS.ErrnoException)=>err?resolve(true):resolve(false)
            );
        })) return{
        errcode :ResponseErrcode.TagNotFound,
        errmsg  :`Tag "${tagAlias}" is not exist.`
    };
    var postsInfoFiles =(<string[]>(await Fs.readdirAsync(POSTS_FILE_PATH)))
        .filter(fileName=>/\.toml$/.test(fileName))
    ;
    var postsList:PostsInfoWithoutContent[] =[];
    for(let fileName of postsInfoFiles){
        let filePath =Path.join(POSTS_FILE_PATH,fileName);
        let postInfo:PostsInfoWithoutContent =Toml2Json(await Fs.readFileAsync(filePath));
        if(postInfo.tag_list.includes(tagAlias)){
            postsList.push(postInfo);
        }
    };
    return {
        errcode:ResponseErrcode.Ok,
        errmsg:'ok',
        posts_length :postsList.length,
        posts_map :function(postsList){
            var postsMap :{[alias in ToString<PostsId>]:PostsInfoWithoutContent} ={};
            postsList.forEach(posts=>postsMap[posts.id.toString()]=posts);
            return postsMap;
        }(postsList),
    };
};
async function getCategoryAll():Promise<Get.category.all.response>{
    var files:string[] =await Fs.readdirAsync(CATEGORY_FILE_PATH);
    var categories:CategoryInfo[] =[];
    for(let fileName of files){
        let filePath =Path.join(CATEGORY_FILE_PATH,fileName);
        let fileContent:string =await Fs.readFileAsync(filePath);
        categories.push(Toml2Json(fileContent));
    };
    return {
        errcode :0,
        errmsg :'ok',
        category_length :categories.length,
        category_map :function(categories){
            var tagMap:{[alias in CategoryAlias]:CategoryInfo;} ={};
            categories.forEach(category=>tagMap[category.alias]=category);
            return tagMap;
        }(categories),
    };
};
async function getCategory(params:any):Promise<Get.category.response|ApiErrorResponse>{
    var categoryMap:IndexMap<CategoryAlias,CategoryInfo> =(await getCategoryAll()).category_map;
    var categoryAlias:CategoryAlias =params['category_alias'];
    if(await new Promise(resolve=>{
            Fs.access(
                Path.join(CATEGORY_FILE_PATH ,`${categoryAlias}.toml`),
                Fs.constants.R_OK,
                (err:NodeJS.ErrnoException)=>err?resolve(true):resolve(false)
            );
        })) return{
        errcode :ResponseErrcode.CategoryNotFound,
        errmsg  :`Category "${categoryAlias}" is not exist.`
    };
    var postsInfoFiles =(<string[]>(await Fs.readdirAsync(POSTS_FILE_PATH)))
        .filter(fileName=>/\.toml$/.test(fileName))
    ;
    var postsList:PostsInfoWithoutContent[] =[];
    for(let fileName of postsInfoFiles){
        let filePath =Path.join(POSTS_FILE_PATH,fileName);
        let postInfo:PostsInfoWithoutContent =Toml2Json(await Fs.readFileAsync(filePath));

        let categoryStack:CategoryInfo[] =[categoryMap[categoryAlias]];
        while(true){
            if(categoryStack.length===0)break;
            let category =categoryStack.pop()!;
            if(postInfo.category_list.includes(category.alias)){
                postsList.push(postInfo);
                break;
            }
            categoryStack.push(...category.child_alias_list.map(alias=>categoryMap[alias]));
        };
    };
    return {
        errcode:ResponseErrcode.Ok,
        errmsg:'ok',
        posts_length :postsList.length,
        posts_map :function(postsList){
            var postsMap :{[alias in ToString<PostsId>]:PostsInfoWithoutContent} ={};
            postsList.forEach(posts=>postsMap[posts.id.toString()]=posts);
            return postsMap;
        }(postsList),
    };
};

module.exports =router;;;