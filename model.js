var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var urlSchema = new Schema({
    url: {type: String, index: true},
    referenceCount: {type: Number},
    paramList: [{type: String}],
    scraped: {type: Boolean, default:false}
});
mongoose.model("urls", urlSchema);
