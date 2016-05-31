/**
 * Created by Waqas on 27-May-16.
 */
var _ = require('lodash');
var assign = require('object-assign');
var cloudinary = require('cloudinary');
var keystone = require('../../../');
var super_ = require('../Type');
var util = require('util');
var utils = require('keystone-utils');
var MPromise = require('mpromise');

var CLOUDINARY_FIELDS = ['public_id', 'version', 'signature', 'format', 'resource_type', 'url', 'width', 'height', 'secure_url', 'thumbnail_url'];

function getEmptyValue () {
	return {
		public_id: '',
		version: 0,
		signature: '',
		format: '',
		resource_type: '',
		url: '',
		width: 0,
		height: 0,
		secure_url: '',
		thumbnail_url: ''
	};
}

/**
 * CloudinaryMedia FieldType Constructor
 * @extends Field
 * @api public
 */
function cloudinarymedia (list, path, options) {

	this._underscoreMethods = ['format'];
	this._fixedSize = 'full';
	this._properties = ['select', 'selectPrefix', 'autoCleanup', 'publicID', 'folder', 'filenameAsPublicID'];

	// TODO: implement filtering, usage disabled for now
	options.nofilter = true;

	// TODO: implement initial form, usage disabled for now
	if (options.initial) {
		throw new Error(
			'Invalid Configuration\n\n' +
			'CloudinaryMedia fields (' + list.key + '.' + path + ') do not currently support being used as initial fields.\n'
		);
	}
	
	cloudinarymedia.super_.call(this, list, path, options);

	// validate cloudinary config
	if (!keystone.get('cloudinary config')) {
		throw new Error(
			'Invalid Configuration\n\n'
			+ 'CloudinaryMedia fields (' + list.key + '.' + this.path + ') require the "cloudinary config" option to be set.\n\n'
			+ 'See http://keystonejs.com/docs/configuration/#services-cloudinary for more information.\n'
		);
	}
}

/*!
 * Inherit from Field
 */

util.inherits(cloudinarymedia, super_);

/**
 * Registers the field on the List's Mongoose Schema.
 *
 * @api public
 */
cloudinarymedia.prototype.addToSchema = function () {

	var field = this;
	var schema = this.list.schema;

	var paths = this.paths = {
		// cloudinary fields
		public_id: this._path.append('.public_id'),
		version: this._path.append('.version'),
		signature: this._path.append('.signature'),
		format: this._path.append('.format'),
		resource_type: this._path.append('.resource_type'),
		url: this._path.append('.url'),
		width: this._path.append('.width'),
		height: this._path.append('.height'),
		secure_url: this._path.append('.secure_url'),
		thumbnail_url: this._path.append('.thumbnail_url'),
		// virtuals
		exists: this._path.append('.exists'),
		folder: this._path.append('.folder'),
		// form paths
		upload: this._path.append('_upload'),
		action: this._path.append('_action'),
		select: this._path.append('_select')
	};

	var schemaPaths = this._path.addTo({}, {
		public_id: String,
		version: Number,
		signature: String,
		format: String,
		resource_type: String,
		url: String,
		width: Number,
		height: Number,
		secure_url: String,
		thumbnail_url: String
	});

	schema.add(schemaPaths);

	var exists = function (item) {
		return (item.get(paths.public_id) ? true : false);
	};

	// The .exists virtual indicates whether an image is stored
	schema.virtual(paths.exists).get(function () {
		return schemaMethods.exists.apply(this);
	});

	var folder = function(item) {//eslint-disable-line no-unused-vars
		var folderValue = null;

		if (keystone.get('cloudinary folders')) {
			if (field.options.folder) {
				folderValue = field.options.folder;
			} else {
				var folderList = keystone.get('cloudinary prefix') ? [keystone.get('cloudinary prefix')] : [];
				folderList.push(field.list.path);
				folderList.push(field.path);
				folderValue = folderList.join('/');
			}
		}

		return folderValue;
	};

	// The .folder virtual returns the cloudinary folder used to upload/select images
	schema.virtual(paths.folder).get(function () {
		return schemaMethods.folder.apply(this);
	});

	var src = function (item, options) {

		if (!exists(item)) {
			return '';
		}

		options = (typeof options === 'object') ? options : {};

		if (!('fetch_format' in options) && keystone.get('cloudinary webp') !== false) {
			options.fetch_format = 'auto';
		}

		if (!('progressive' in options) && keystone.get('cloudinary progressive') !== false) {
			options.progressive = true;
		}

		if (!('secure' in options) && keystone.get('cloudinary secure')) {
			options.secure = true;
		}

		options.version = item.get(paths.version);

		return cloudinary.url(item.get(paths.public_id) + '.' + item.get(paths.format), options);

	};

	var reset = function (item) {
		item.set(field.path, getEmptyValue());
	};

	var addSize = function (options, width, height, other) {
		if (width) options.width = width;
		if (height) options.height = height;
		if (typeof other === 'object') {
			assign(options, other);
		}
		return options;
	};

	var schemaMethods = {
		exists: function () {
			return exists(this);
		},
		folder: function () {
			return folder(this);//field.getFolder();
		},
		src: function (options) {
			return src(this, options);
		},
		tag: function (options) {
			return exists(this) ? cloudinary.image(this.get(field.path), options) : '';
		},
		scale: function (width, height, options) {
			return src(this, addSize({ crop: 'scale' }, width, height, options));
		},
		fill: function (width, height, options) {
			return src(this, addSize({ crop: 'fill', gravity: 'faces' }, width, height, options));
		},
		lfill: function (width, height, options) {
			return src(this, addSize({ crop: 'lfill', gravity: 'faces' }, width, height, options));
		},
		fit: function (width, height, options) {
			return src(this, addSize({ crop: 'fit' }, width, height, options));
		},
		limit: function (width, height, options) {
			return src(this, addSize({ crop: 'limit' }, width, height, options));
		},
		pad: function (width, height, options) {
			return src(this, addSize({ crop: 'pad' }, width, height, options));
		},
		lpad: function (width, height, options) {
			return src(this, addSize({ crop: 'lpad' }, width, height, options));
		},
		crop: function (width, height, options) {
			return src(this, addSize({ crop: 'crop', gravity: 'faces' }, width, height, options));
		},
		thumbnail: function (width, height, options) {
			return src(this, addSize({ crop: 'thumb', gravity: 'faces' }, width, height, options));
		},
		/**
		 * Resets the value of the field
		 *
		 * @api public
		 */
		reset: function () {
			reset(this);
		},
		
		/**
		 * Deletes the image from Cloudinary and resets the field
		 *
		 * @api public
		 */
		delete: function() {
			var promise = new MPromise();
			cloudinary.uploader.destroy(this.get(paths.public_id), function(result) {
				// result.result=== "ok" if successfull
				promise.fulfill(result);
			},{
				resource_type: 'video'
			});
			reset(this);

			return promise;
		},
		/**
		 * Uploads the image to Cloudinary
		 *
		 * @api public
		 */
		upload: function(file, options) {
			var promise = new MPromise();

			cloudinary.uploader.upload(file, function(result) {
				promise.fulfill(result);
			}, options);

			return promise;
		}
	};

	_.forEach(schemaMethods, function (fn, key) {
		field.underscoreMethod(key, fn);
	});

	// expose a method on the field to call schema methods
	this.apply = function (item, method) {
		return schemaMethods[method].apply(item, Array.prototype.slice.call(arguments, 2));
	};

	this.bindUnderscoreMethods();
};

/**
 * Formats the field value
 *
 * @api public
 */
cloudinarymedia.prototype.format = function (item) {
	return item.get(this.paths.url);
};

/**
 * Detects whether the field has been modified
 *
 * @api public
 */
cloudinarymedia.prototype.isModified = function (item) {
	return item.isModified(this.paths.url);
};


/**
 * Validates that a value for this field has been provided in a data object
 */
cloudinarymedia.prototype.validateInput = function (data, callback) {
	return true;
};

/**
 * Validates that input has been provided
 */
cloudinarymedia.prototype.validateRequiredInput = function (item, data, callback) {
	return true;
};

/**
 * Always assumes the input is valid
 *
 * Deprecated
 */
cloudinarymedia.prototype.inputIsValid = function () {
	return true;
};

/**
 * Updates the value for this field in the item from a data object
 *
 * @api public
 */
cloudinarymedia.prototype.updateItem = function (item, data) {
	var paths = this.paths;
    
	var setValue = function(key) {
		if (paths[key]) {
			var index = paths[key].indexOf('.');
			var field = paths[key].substr(0, index);
			// Note we allow implicit conversion here so that numbers submitted as strings in the data object
			// aren't treated as different values to the stored Number values
			if (data[field] && data[field][key] && data[field][key] != item.get(paths[key])) { // eslint-disable-line eqeqeq
				item.set(paths[key], data[field][key] || null);
			}
		}
	};

	_.each(['public_id', 'version', 'signature', 'format', 'resource_type', 'url', 'width', 'height', 'secure_url', 'thumbnail_url'], setValue);
};

/**
 * Returns a callback that handles a standard form submission for the field
 *
 * Expected form parts are
 * - `field.paths.action` in `req.body` (`clear` or `delete`)
 * - `field.paths.upload` in `req.files` (uploads the image to cloudinary)
 *
 * @api public
 */
cloudinarymedia.prototype.getRequestHandler = function (item, req, paths, callback) {
	var field = this;

	if (utils.isFunction(paths)) {
		callback = paths;
		paths = field.paths;
	} else if (!paths) {
		paths = field.paths;
	}

	callback = callback ||function () {};

	return function () {

		if (req.body) {
			var action = req.body[paths.action];

			if (/^(delete|reset)$/.test(action)) {
				field.apply(item, action);
			}
		}

		if (req.body && req.body[paths.select]) {



			//TODO: waterfall this shizzle

			cloudinary.api.resource(req.body[paths.select], function (result) {
				if (result.error) {
					cloudinary.api.resource(req.body[paths.select], function (result) {
						if (result.error) {
							callback(result.error);
						} else {
							item.set(field.path, result);
							callback();
						}
					}, {
						resource_type: 'auto'
					})
				} else {
					item.set(field.path, result);
					callback();
				}
			}, {
				resource_type: 'auto'
			});

		} else if (req.files && req.files[paths.upload] && req.files[paths.upload].size) {

			var tp = keystone.get('cloudinary prefix') || '';
			var imageDelete;

			if (tp.length) {
				tp += '_';
			}

			var uploadOptions = {
				tags: [tp + field.list.path + '_' + field.path, tp + field.list.path + '_' + field.path + '_' + item.id],
				resource_type: "auto"
			};

			if (keystone.get('cloudinary folders')) {
				uploadOptions.folder = item.get(paths.folder);
			}

			if (keystone.get('cloudinary prefix')) {
				uploadOptions.tags.push(keystone.get('cloudinary prefix'));
			}

			if (keystone.get('env') !== 'production') {
				uploadOptions.tags.push(tp + 'dev');
			}

			if (field.options.publicID) {
				var publicIdValue = item.get(field.options.publicID);
				if (publicIdValue) {
					uploadOptions.public_id = publicIdValue;
				}
			} else if (field.options.filenameAsPublicID) {
				uploadOptions.public_id = req.files[paths.upload].originalname.substring(0, req.files[paths.upload].originalname.lastIndexOf('.'));
			}

			if (field.options.folder) {
				uploadOptions.folder = field.options.folder
			}

			if (field.options.useFilename) {
				uploadOptions.use_filename = true; //default is false
				if (!field.options.uniqueFilename) {
					uploadOptions.unique_filename = false; //default is true
				}
			}

			if (field.options.autoCleanup && item.get(field.paths.exists)) {
				// capture image delete promise
				imageDelete = field.apply(item, 'delete');
			}

			var getThumbnailUrl = function(data) {
				var url = data.url;
				if (url) {
					url = url.replace(/image\/upload/, 'image/upload/c_thumb,g_face,h_90,w_90');
					if (data.resource_type === 'video') {
						var format = data.format;
						url = url.replace(format, 'jpg');
					}
				}
				return url;
			};

			// callback to be called upon completion of the 'upload' method
			var uploadComplete = function (result) {
				if (result.error) {
					callback(result.error);
				} else {
					result.thumbnail_url = getThumbnailUrl(result);
					item.set(field.path, result);
					callback();
				}
			};

			// upload immediately if image is not being delete
			if (typeof imageDelete === 'undefined') {
				field.apply(item, 'upload', req.files[paths.upload].path, uploadOptions).onFulfill(uploadComplete);
			} else {
				// otherwise wait until image is deleted before uploading
				// this avoids problems when deleting/uploading images with the same public_id (issue #598)
				imageDelete.then(function (result) {
					if (result.error) {
						callback(result.error);
					} else {
						field.apply(item, 'upload', req.files[paths.upload].path, uploadOptions).onFulfill(uploadComplete);
					}
				});
			}

		} else {
			callback();
		}

	};

};

/**
 * Immediately handles a standard form submission for the field (see `getRequestHandler()`)
 *
 * @api public
 */
cloudinarymedia.prototype.handleRequest = function (item, req, paths, callback) {
	this.getRequestHandler(item, req, paths, callback)();
};

/*!
 * Export class
 */
module.exports = cloudinarymedia;
