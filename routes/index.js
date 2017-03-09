const express = require('express');
const indexRoute = express.Router();
var NodeGeocoder = require('node-geocoder');
const Buoy = require('../models/buoy.js');
const request = require('request');
const User = require('../models/users.js');
const passport = require('passport');

// Bcrypt to encrypt passwords
const bcrypt = require("bcrypt");
const bcryptSalt = 10;


/* GET home page. */
indexRoute.get('/', (req, res, next) => {
    res.render('index', {
        title: "Landing",
        successMessage: req.flash('success')
    });
});

/// GOOGLE API ACTION

var options = {
    provider: 'google',
    apiKey: process.env.GMAPS_API,
};

var geocoder = NodeGeocoder(options);

/* GET DASHBOARD */
indexRoute.post('/dashboard', (req, res, next) => {
    const userZip = req.body.zipcode;

    if (userZip === '') { ////NO ERROR MESSAGE YET
        res.render('index', {
            errorMessage: "Please enter zip code to continue.."
        });
        return;
    }
    /// TURNS USER ZIP TO LAT LONG /////
    geocoder.geocode(userZip, function(err, geocodeResult) {
        if (err) {
            next(err);
            return;
        }
        const latitude = geocodeResult[0].latitude;
        const longitude = geocodeResult[0].longitude;


        const userCoords = [longitude, latitude];
        // Using the user's coords find the closes
        // Buoy by its coords
        Buoy.findOne({
            loc: {
                $near: userCoords
            }
        }, (err, buoys) => {
            if (err) {
                next(err);
                return;
            }
            const day = new Date();
            let dd = day.getDate();
            let mm = day.getMonth() + 1; //Starts at 0
            const yy = day.getFullYear();

            if (mm < 10) {
                mm = '0' + mm;
            }
            if (dd < 10) {
                dd = '0' + dd;
            }

            //DATE USER MAKES POST REQ
            const today = `${yy}${mm}${dd}`;

            const link = `https://tidesandcurrents.noaa.gov/api/datagetter?station=${buoys.stationID}&product=water_level&time_zone=gmt&format=json&begin_date=${today}&end_date=${today}&units=metric&datum=msl`;
            ///Returns live data from Buoy////
            request(link, function(error, response, body) {
                if (error) {
                    next(error);
                    return;
                }
                const parsedTimes = [];
                const parsedLevels = [];
                //Parse the JSON FILES WITH THE data
                //We want to have
               JSON.parse(body, ( name, value ) => {
                    if (name === 't' ) {
                      parsedTimes.push(value);
                      return;

                    }
                    if (name === 'v'){
                      parsedLevels.push(value);
                      return;
                    }
                    else {
                      return undefined;
                    }

                  });
                  //Turn the string of "dates" to actual dates
                  parsedTimes.forEach((time) =>{
                    let eachTime = new Date(time);
                    let eachTimeRangeMAX = new Date(eachTime);
                    let eachTimeRangeMIN = new Date(eachTime);
                    //Find the closest time with Range (+6/-6)
                    eachTimeRangeMAX.setMinutes(eachTime.getMinutes() + 6);
                    eachTimeRangeMIN.setMinutes(eachTime.getMinutes() - 6);

                  //  eachTime.setMinutes(eachTime.getMinutes() + 6);
                   //
                  //   eachTime.setMinutes(eachTime.getMinutes() - 6);

                    if (eachTimeRangeMAX >= day && eachTimeRangeMIN <= day) {
                      const currentTimeIndex = parsedTimes.indexOf(eachTime);
                      console.log(currentTimeIndex);
                    }
                  });
                  res.redirect('/');
                  //
                  // console.log(parsedData);
                //
                // res.render('dashboard', {
                //     zipcode: userZip,
                //     coords: userCoords,
                //     buoyID: buoys.stationID,
                //     buoyName: buoys.buoyName,
                //     buoyData: body

                });

            });

        });
    // });
});

/* GET LOGIN */
indexRoute.get('/login', (req, res, next) => {
    res.render('login.ejs', {
        errorMessage: req.flash('error') //req.flash returns array
    });
});

// POST LOGIN
indexRoute.post("/login",
    passport.authenticate("local", {
        successReturnToOrRedirect: "/",
        failureRedirect: "/login",
        failureFlash: true,
        successFlash: 'You successfully logged in',
        passReqToCallback: true
    }));

/* GET REGISTER */
indexRoute.get('/register', (req, res, next) => {
    res.render('register');
});

/* POST REGISTER */
indexRoute.post('/register', (req, res, next) => {
    const username = req.body.username;
    const password = req.body.password;
    res.render('register');


    if (username === "" || password === "") {
        res.render('/register', {
            message: "Please make sure you fill both fields"
        });
        return;
    }

    User.findOne({
        username
    }, "username", (err, user) => {
        if (user !== null) {
            res.render('/register', {
                message: "You're already part of the club!"
            });
            return;
        }

        const salt = bcrypt.genSaltSync(bcryptSalt);
        const hashPass = bcrypt.hashSync(password, salt);

        const newUser = User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            userName: username,
            encryptedPassword: hashPass
        });

        newUser.save((err) => {
            if (err) { // IF problem
                res.render("/register", {
                    message: "Something went wrong"
                });
            } else { // If no problem ;)
                req.flash('success', 'You have been registered. Welcome to the wave.');
                res.redirect("index");
            }
        });
    });
});




module.exports = indexRoute;
