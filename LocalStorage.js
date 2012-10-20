/*jslint browser: true */
/*global define: true */

define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/json",
    "dojo/store/util/QueryResults",
    "dojo/store/util/SimpleQueryEngine"
], function (
    declare,
    lang,
    json,
    QueryResults,
    SimpleQueryEngine
) {
    "use strict";

    // localStorage polyfill, implements a replacement for HTML5's localStorage when it is not supported.  
    // It implements a nearly identical interface using userData for IE6-7 and globalStorage for FF2-3.
    // From: https://github.com/wojodesign/local-storage-js
    var localStorage = window.localStorage;
    // check to see if we have localStorage or not
	if(typeof localStorage == 'undefined'){		

		// globalStorage
		// non-standard: Firefox 2+
		// https://developer.mozilla.org/en/dom/storage#globalStorage
		if ( window.globalStorage ) {
			// try/catch for file protocol in Firefox
			try {
				window.localStorage = window.globalStorage;
			} catch( e ) {}
			return;
		}

		// userData
		// non-standard: IE 5+
		// http://msdn.microsoft.com/en-us/library/ms531424(v=vs.85).aspx
		var div = document.createElement( "div" ),
			attrKey = "localStorage";
		div.style.display = "none";
		document.getElementsByTagName( "head" )[ 0 ].appendChild( div );
		if ( div.addBehavior ) {
			div.addBehavior( "#default#userdata" );
			//div.style.behavior = "url('#default#userData')";

			localStorage = window["localStorage"] = {
				"length":0,
				"setItem":function( key , value ){
					div.load( attrKey );
					key = cleanKey(key );

					if( !div.getAttribute( key ) ){
						this.length++;
					}
					div.setAttribute( key , value );

					div.save( attrKey );
				},
				"getItem":function( key ){
					div.load( attrKey );
					key = cleanKey(key );
					return div.getAttribute( key );

				},
				"removeItem":function( key ){
					div.load( attrKey );
					key = cleanKey(key );
					div.removeAttribute( key );

					div.save( attrKey );
					this.length--;
					if( this.length < 0){
						this.length=0;
					}
				},

				"clear":function(){
					div.load( attrKey );
					var i = 0;
					while ( attr = div.XMLDocument.documentElement.attributes[ i++ ] ) {
						div.removeAttribute( attr.name );
					}
					div.save( attrKey );
					this.length=0;
				}, 

				"key":function( key ){
					div.load( attrKey );
					return div.XMLDocument.documentElement.attributes[ key ];
				}

			},

			// convert invalid characters to dashes
			// http://www.w3.org/TR/REC-xml/#NT-Name
			// simplified to assume the starting character is valid
			cleanKey = function( key ){
				return key.replace( /[^-._0-9A-Za-z\xb7\xc0-\xd6\xd8-\xf6\xf8-\u037d\u37f-\u1fff\u200c-\u200d\u203f\u2040\u2070-\u218f]/g, "-" );
			};


			div.load( attrKey );
			localStorage["length"] = div.XMLDocument.documentElement.attributes.length;
		}
	}

    return declare(null, {

        // idProperty: String
        //      Indicates the property to use as the identity property. The values of this
        //      property should be unique.
        idProperty: "id",

        // queryEngine: Function
        //      Defines the query engine to use for querying the data store
        queryEngine: SimpleQueryEngine,

        // subsetProperty: String
        //      Limit this store by configuration to work with a specified subset of objects
        //      Before storing an object, the store adds a property with this name to it
        //      This property is removed upon object retrieval, making this feature transparent to a client
        subsetProperty: null,

        // subsetName: mixed
        //      Define a subset name. See subsetProperty for more information
        subsetName: null,

        constructor: function (options) {
            // summary:
            //      localStorage based object store.
            // options:
            //      This provides any configuration information that will be mixed into the store.
            //      This should generally include the data property to provide the starting set of data.
            lang.mixin(this, options);
            this.setData(this.data || []);
        },

        get: function (id) {
            // summary:
            //      Retrieves an object by its identity
            // id: Number
            //      The key of the key/value pair as stored in localStorage
            //      If not already present, the id is added to the returned object - object[this.idProperty]
            // returns: Object
            //      The value in the store that matches the given id (key).
            var item = localStorage.getItem(id), object = null;

            try {
                object = json.parse(item);
                object[this.idProperty] = id;

                if (this.subsetProperty) {
                    if (object[this.subsetProperty] !== this.subsetName) {
                        return undefined;
                    }

                    delete object[this.subsetProperty];
                }

                return object;
            } catch (e) {
                return undefined;
            }
        },

        getIdentity: function (object) {
            // summary:
            //      Returns an object's identity
            // object: Object
            //      The object to get the identity from
            // returns: Number
            return object[this.idProperty];
        },

        put: function (object, options) {
            // summary:
            //      Stores an object
            // object: Object
            //      The object to store.
            // options: Object?
            //      Additional metadata for storing the data. Includes an "id"
            //      property if a specific id is to be used.
            // returns: Number
            var id = (options && options.id) || object[this.idProperty] || Math.random();

            if (this.subsetProperty) {
                object[this.subsetProperty] = this.subsetName;
            }
            delete object[this.idProperty];

            localStorage.setItem(id, json.stringify(object));
            return id;
        },

        add: function (object, options) {
            // summary:
            //      Creates an object, throws an error if the object already exists
            // object: Object
            //      The object to store.
            // options: Object?
            //      Additional metadata for storing the data. Includes an "id"
            //      property if a specific id is to be used.
            // returns: Number
            if (this.get(object[this.idProperty])) {
                throw new Error("Object already exists");
            }

            return this.put(object, options);
        },

        remove: function (id) {
            // summary:
            //      Deletes an object by its identity
            // id: Number
            //      The identity to use to delete the object
            localStorage.removeItem(id);
        },

        query: function (query, options) {
            // summary:
            //      Queries the store for objects.
            // query: Object
            //      The query to use for retrieving objects from the store.
            // options: dojo.store.util.SimpleQueryEngine.__queryOptions?
            //      The optional arguments to apply to the resultset.
            // returns: dojo.store.util.QueryResults
            //      The results of the query, extended with iterative methods.
            //
            // example:
            // Given the following store:
            //
            // | var store = new dojo.store.LocalStorage({
            // | data: [
            // | {id: 1, name: "one", prime: false },
            // | {id: 2, name: "two", even: true, prime: true},
            // | {id: 3, name: "three", prime: true},
            // | {id: 4, name: "four", even: true, prime: false},
            // | {id: 5, name: "five", prime: true}
            // | ]
            // | });
            //
            // ...find all items where "prime" is true:
            //
            // | var results = store.query({ prime: true });
            //
            // ...or find all items where "even" is true:
            //
            // | var results = store.query({ even: true });

            var data = [], i = 0, id = null, item = null;

            for (i = 0; i < localStorage.length; i += 1) {
                id = localStorage.key(i);
                item = this.get(id);

                if (item) {
                    data.push(item);
                }
            }

            return QueryResults(this.queryEngine(query, options)(data));
        },

        setData: function (data) {
            // summary:
            //      Sets the given data as the source for this store, and indexes it
            // data: Object[]
            //      An array of objects to use as the source of data.

            var i = 0, object = null;

            if (data.items) {
                // just for convenience with the data format IFRS expects
                this.idProperty = data.identifier;
                data = this.data = data.items;
            }

            for (i = 0; i < data.length; i += 1) {
                object = data[i];
                this.put(object);
            }
        }
    });
});