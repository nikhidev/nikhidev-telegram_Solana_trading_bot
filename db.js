
const mongoose  = require("mongoose");
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("MongoDB Connected...")
}).catch(err => {
    console.log(err)
});

const UserSchema = mongoose.Schema({
    telegram_id :{type:Number,required:true,unique:true},
    public_key :{type:String,required:true},
    private_key :{type:String,required:true},
});

const User = mongoose.model('User', UserSchema);
module.exports = {User};