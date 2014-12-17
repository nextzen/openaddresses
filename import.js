/**
 * @file Entry-point script for the OpenAddresses import pipeline.
 */

'use strict';

var fs = require( 'fs' );
var path = require( 'path' );

var through = require( 'through2' );
var csvParser = require( 'fast-csv' );
var peliasModel = require( 'pelias-model' );
var peliasDbclient = require( 'pelias-dbclient' );
var peliasSuggesterPipeline = require( 'pelias-suggester-pipeline' );

var createAdminValues = require( './lib/create_admin_values' );

function importOpenAddressesFile( filePath ){
  var baseName = path.basename(filePath, ".csv")
  var adminValues = createAdminValues(
    baseName, path.join(__dirname, "openaddresses_sources")
  );

  var uid = 0;
  var documentCreator = through.obj( function write( record, enc, next ){
    if(-90 < record[ ' LAT' ] && record[ ' LAT' ] < 90 &&
      -180 < record[ 'LON' ] && record[ 'LON' ] < 180){
      var model_id = ( uid++ ).toString();
      var addrDoc = new peliasModel.Document( 'openaddresses', model_id )
        .setName( 'default', record[ ' NUMBER' ] + ' ' + record[ ' STREET' ] )
        .setAdmin( 'admin0', adminValues.country )
        .setCentroid( { lat: record[ ' LAT' ], lon: record[ 'LON' ] } )

      if( adminValues.region !== undefined ){
        addrDoc.setAdmin( 'admin1', adminValues.region );
      }

      if( adminValues.locality !== undefined ){
        addrDoc.setAdmin( 'admin2', adminValues.locality );
      }

      this.push( addrDoc );
    }
    next();
  });

  var dbclientMapper = through.obj( function( model, enc, next ){
    this.push({
      _index: 'pelias',
      _type: model.getType(),
      _id: model.getId(),
      data: model
    });
    next();
  })

  var recordStream = fs.createReadStream( filePath )
    .pipe( csvParser( { headers: true } ) )
    .pipe( documentCreator )
    .pipe( peliasSuggesterPipeline.pipeline )
    .pipe( dbclientMapper )
    .pipe( peliasDbclient() );
}

function handleUserArgs( argv ){
  var usageMessage = 'TODO: usage message.';
  if( argv.length !== 1 ){
    console.error( usageMessage );
    process.exit( 1 );
  }
  else {
    importOpenAddressesFile( argv[ 0 ] );
  }
}

handleUserArgs( process.argv.slice( 2 ) );