//jshint esversion:6

require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session')
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const { authenticate } = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')


const app = express()

const saltRounds = 10

app.use(express.static("public"))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(session({
  secret: "Our little secret",
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

mongoose.connect("mongodb://0.0.0.0:27017/userDB", {useNewUrlParser: true})

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: Array
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy())

passport.serializeUser(function (user, done) {
    done(null, user.id)
  })
passport.deserializeUser(function (id, done) {
  try {
    User.findById(id).then(user=>{
        done(null,user);
    })
  }
  catch (err){
      done(err);
  }
    })

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets"
},
async function (accessToken, refreshToken, profile, done) {
  try {
    console.log(profile);
    // Find or create user in your database
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      // Create new user in database
      const username = Array.isArray(profile.emails) && profile.emails.length > 0 ? profile.emails[0].value.split('@')[0] : '';
      const newUser = new User({
        username: profile.displayName,
        googleId: profile.id
      });
      user = await newUser.save();
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}
));

app.get("/", function (req, res) {
    res.render("home")
  })

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] }))

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/login", function (req, res) {
    res.render("login")
  })

app.get("/register", function (req, res) {
    res.render("register")
  })

app.get("/secrets", function (req, res) {
    if(req.isAuthenticated()){
      User.find({"secret": {$ne: null}}).then((foundUsers) => {
        res.render("secrets", {usersWithSecrets: foundUsers})
      }).catch((err) => {
        console.log(err);
      })
    } else {
      res.redirect("/login")
    }
  }) 

app.get("/submit", function (req, res) {
    if(req.isAuthenticated()){
      res.render("submit")
    } else {
      res.redirect("/login")
    }
  })

app.post("/register", function (req, res) {
/*
  bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        
    const newUser = new User({
        email: req.body.username,
        password: hash
    })

    newUser.save().then(() => {
        res.render("secrets")
    }).catch((err) => {
        console.log(err)
    })

    });
    */

    User.register({username: req.body.username}, req.body.password, function (err, user) {
      
      if(err){
        console.log(err)
        res.redirect("/register")
      } else {
        passport.authenticate("local")(req,res, function () {
          res.redirect("/login")
          })
      }
    })
  })

app.post("/login", function (req, res) {

  /*
    const username = req.body.username
    const password = req.body.password

    User.findOne({email: username}).exec().then((foundUser) => {

      bcrypt.compare(password, foundUser.password, function(err, result) {
        if(result === true) {
          res.render("secrets")
        } else {
          console.log(err)
        }
      })
    })
    */

    const user = new User({
      username: req.body.username,
      password: req.body.password
    })

    req.login(user, function (err) {
      if(err){
        console.log(err);
      } else {
        passport.authenticate("local")(req,res, function () {
          res.redirect("/secrets")
          })
      }
      })
  })

  app.post("/submit", function (req, res) {
      const submittedSecret = req.body.secret

      User.findById(req.user.id).then((foundUser) => {
        foundUser.secret.push(submittedSecret)
        foundUser.save()
        res.redirect("/secrets")
      }).catch((err) => {
        console.log(err);
      })

    })

  app.get('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    })
  })


app.listen(3000, function (req, res) {
    console.log("Server started on port 3000");
  })