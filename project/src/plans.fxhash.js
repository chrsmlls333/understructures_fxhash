/*
   By Christopher Eugene Mills

   bw2: Added offscreen buffer so that canvas doesn't reset on resize
	 bw3: Added imageset of pregenerated backgrounds
	 fxhash: trim filelist and add deterministic random
 */

import p5 from 'p5'
import * as CEM from 'cemjs'


// FXHASH ////////////////////////////////////////////////////

const seed = ~~ (fxrand() * 999999999)
// these are the variables you can use as inputs to your algorithms
// console.log('hash', fxhash)   // the 64 chars hex number fed to your algorithm
// console.log('rand', fxrand()) // deterministic PRNG function, use it instead of Math.random()
let fxPreviewCalled = false;


// SETTINGS //////////////////////////////////////////////////

CEM.setVerbose(false)

const titleText =
`Understructures (
   Lift Yr. Skinny Fists
      Like Antennas to Heaven )`
const authorText = "Chris Eugene Mills"

const imagePath = "./assets/plans-iso-tiny/"
const imageFilenamesPath = "./assets/plans-iso-tiny/filenames.json"
const headstartPath = "./assets/headstart/"

const canvasSize = { width: 1920, height: 1080 };
const loadingAreaSize = { width: 400, height: 400 };
const loadingFloors = 20;

var headstartBuild = true;
var headstartNumBuildings = 100;

var speedrun = false; //No delays
var autoContinue = true; //Leave true, false disables continu() function
var newSet = true; //Divide into sets or procedurally add
var reloadURL = false; //Reload page every set
var fade = false; //Continually fades to black
var setClean = false; //Erases between sets
var setFade = false; //Fades between sets
var setSwitch = true; //Switch between black and white
var drawBasements = false; //Add reversed floors below

var stepDelay = 70; //Delay between floors
var buildingDelay = 350; //Delay between buildings
var newSetDelay = 800; //Delay between sets

var bg = 24; //Background color
var floorSpacingRange = [ 20, 30 ]; //X spacing between floors
var fVal = [ 8, 40 ]; //# of floors
var buildingsInSetRange = [ 5, 10 ]; //# of basement floors
var scaleVal = [ 0.3, 0.5 ]; //Building XY Scale
var breadth = 1.1; //Distribution of buildings from center

var debugPositions = false; //Displays source points and imag flip/rotate settings 

// Variables ////////////////////////////////////////////////////

var canvas, off, loa; //Drawing surfaces
var blendSetting;
var lighterOrDarker; //Which Set of images to pull from
var buildingsInSet, building, floorsInBuilding, floor, basementsInBuilding, basement, floorSpacing, centerShift;
var img, loadingimg; 
var loc, rot, scal, flip;
var screenScale;
var buildingsCount, setsCount, headstartProgress;
var imageFilenames;
var download = false;

// CORE /////////////////////////////////////////////////////////

const sketch = p5 => {


	p5.preload = () => {

		// FXHASH // Lock all random calls to fxhash seed
		p5.randomSeed(seed);

		// Preload plan image reference
		p5.loadJSON(imageFilenamesPath, function(data) {
			imageFilenames = data.filenames

			// Preload 1 floorplan for loading animation
			if (headstartBuild) {
				let num = p5.floor( p5.random( imageFilenames.length ) );
				let path = imagePath + "white/" + imageFilenames[num];
				loadingimg = p5.loadImage( path, null, function() {
					CEM.error( "FAILED: " + path );
					this._decrementPreload(); //hack to say everything is fine
				} )
			}
		})

	}

	p5.setup = () => {
		p5.pixelDensity(1);
		canvas = p5.createCanvas( p5.windowWidth, p5.windowHeight );
		//canvas.position( 0, 0 );
		//canvas.parent( 'sketch' );
		p5.noSmooth();
		p5.background( 0 );

		//Resettable
		init2(); 
	}
	
	p5.draw = () => {
		p5.background( 0 );

		//Draw Offscreen Canvas Buffer
		p5.translate( p5.width / 2, p5.height / 2 );
		p5.scale( screenScale ); //Scale from Center
		p5.translate( off.width / -2, off.height / -2 );

		p5.image( off, 0, 0 );

		//Draw Loading "Icon"
		headstartProgress = buildingsCount / headstartNumBuildings;
		if (headstartBuild && loa && loadingimg && headstartProgress < 1.0) {
			drawLoading( headstartProgress );
			p5.image( loa, 0, 0 );
		}

		//Preview Logic
		if (!fxPreviewCalled && (
			(headstartBuild && headstartProgress >= 1.0) || 
			(!headstartBuild && p5.millis() > 30000)
		)) {
			$fx.preview();
			fxPreviewCalled = true;
		}

		//Download
		if (download && !(headstartBuild && headstartProgress < 1.0)) { 
			p5.save(off, `understructures_${fxhash}_${(p5.millis().toFixed(0))}.png`);
			download = false;
		}
	}

	function init2() {
		CEM.newl();
		CEM.print( ">>>>>>> RESET <<<<<<<<" );
		
		//Reset Canvas Buffer
		if (!off) off = p5.createGraphics( canvasSize.width, canvasSize.height );
		off.pixelDensity(1);
		off.background( bg );
		//off.noSmooth();
		off.fill( bg, 255 / 40 );
		off.noStroke();
		screenScale = CEM.calcScale( canvas, off, "fill" );

		//Reset Loading Animation Buffer
		if (!loa) loa = p5.createGraphics( canvasSize.width, canvasSize.height );
		loa.smooth();
		loa.clear();
		loa.noStroke();
		loa.fill(255);
		loa.textSize(24); 
		loa.textFont('monospace');

		//Reset Values
		lighterOrDarker = true;
		blendSetting = p5.ADD;
		buildingsInSet = building = 0;
		floorsInBuilding = floor = 0;
		basementsInBuilding = basement = 0;
		setsCount = buildingsCount = headstartProgress = 0;
	
		startSet();
	}

	p5.windowResized = () => {
		p5.resizeCanvas( p5.windowWidth, p5.windowHeight );
		screenScale = CEM.calcScale( canvas, off, "fill" );
	}

	function drawLoading(progress_) {
		let progress = p5.constrain(progress_, 0, 1);

		let loadingimgScale = CEM.calcScale( loadingAreaSize, loadingimg, "fit" );
		let moveDistance = loadingAreaSize.height - loadingimg.height*loadingimgScale;
		let floors = loadingFloors;

		//loa.clear(); 
		loa.background( bg );
		loa.push();
		loa.translate( loa.width/2, loa.height/2)
		loa.translate( loadingAreaSize.width/-2, loadingAreaSize.height/-2,)
		
		// Draw plans progress stack
		for (let f = 0; f < Math.floor(floors * progress); f++) {
			let dist = moveDistance * (1 - f/(floors-1));
			loa.push();
			loa.translate( 0, dist ); 
			loa.scale( loadingimgScale );
			loa.blend( loadingimg, 0, 0, loadingimg.width, loadingimg.height, 0, 0, loadingimg.width, loadingimg.height, p5.LIGHTEST );
			loa.pop();
		}

		// Draw title
		loa.push();
		loa.translate( loadingAreaSize.width/2, 0 );
		// loa.textAlign( p5.CENTER, p5.BOTTOM );
		// loa.text( authorText, 0, 0 );
		loa.translate( -200, -60 );
		loa.textAlign( p5.LEFT, p5.BOTTOM );
		loa.text( titleText, 0, 0 );
		loa.pop();

		// Draw progress text
		loa.translate(loadingAreaSize.width/2, loadingAreaSize.height + 80);
		loa.textAlign(p5.CENTER, p5.TOP); 
		// loa.text(`Loading... ${Math.floor(progress*100)}%\n'`, 0, 0);
		loa.text(`Laying Foundations: ${buildingsCount}/${headstartNumBuildings}\nArchitectural Plans: ${imageFilenames.length}`, 0, 0);

		loa.pop();
	}

	function startSet() {
		CEM.newl();
		CEM.print( ">>>>>>> NEW SET <<<<<<<<" );
		setsCount++;
	
		//Clear Timers
		CEM.clearTimers();
	
		if ( setClean ) off.background( bg );
		
		var blendingMethod = 0; //p5.random() > 0.5;
		if (blendingMethod) {
			if ( lighterOrDarker ) blendSetting = p5.LIGHTEST;
			else blendSetting = p5.DARKEST;
		} else {
			if ( lighterOrDarker ) blendSetting = p5.SCREEN;
			else blendSetting = p5.MULTIPLY;
		}
	
		// Floor Spacing
		floorSpacing = p5.floor( p5.random( floorSpacingRange[ 0 ], floorSpacingRange[ 1 ] ) );
		CEM.print( "FloorDiff: " + floorSpacing );
	
		//Calculate x shift, honestly can't remember how this works but it does
		centerShift = ( ( floorSpacingRange[ 1 ] - floorSpacingRange[ 0 ] ) / 2 + floorSpacingRange[ 0 ] ) * ( ( fVal[ 1 ] - fVal[ 0 ] ) / 2 + fVal[ 0 ] ) / 2;
	
		//Number of buildings
		buildingsInSet = p5.ceil( p5.random( buildingsInSetRange[ 0 ], buildingsInSetRange[ 1 ] ) );
		if ( !lighterOrDarker ) buildingsInSet *= 1.25; //More Black
		CEM.print( "Buildings: " + buildingsInSet );
		building = 0;
	
		//Next Step
		startBuilding();
	}
	
	
	function startBuilding() {
		CEM.newl();
	
		//Fetch new image
		var path = newFile(lighterOrDarker)
		img = p5.loadImage( path,
			function () {
				CEM.print( "Loaded: " + path )
				building++;
				buildingsCount++;
	
				//How many floors?
				floorsInBuilding = p5.floor( p5.random( fVal[ 0 ], fVal[ 1 ] ) );
				CEM.print( "Floors: " + floorsInBuilding );
				floor = 0;
				basementsInBuilding = p5.floor( p5.random( 0, floorsInBuilding / 3 ) );
				basementsInBuilding *= drawBasements;
				CEM.print( " Below: " + basementsInBuilding );
				basement = 0;
	
				//Generate locations, etc
				generateLocations();
	
				//Next step
				if ( drawBasements ) {
					CEM.newTimer( addBase, skipCheck(stepDelay) );
				} else {
					CEM.newTimer( addFloor, skipCheck(stepDelay) );
				}
			},
			function () {
				CEM.error( "FAILED: " + path );
				CEM.newTimer( startBuilding, skipCheck(stepDelay) );
			}
		);
	
		function newFile(lighterOrDarker_) { 
			var folder = lighterOrDarker_ ? "white/" : "black/";
			var num = p5.floor( p5.random( imageFilenames.length ) );
			var p = imagePath + folder + imageFilenames[num];
			return p;
		}
	
		function generateLocations() {
			rot = p5.random() > 0.5;
			scal = p5.random( scaleVal[ 0 ], scaleVal[ 1 ] );
			flip = p5.random() > 0.5;
			var br = ( breadth / scal ); //account for scaling
			loc = p5.createVector(  p5.random( off.width  / 2 - off.width  * br / 2, off.width  / 2 + off.width  * br / 2 ),
															p5.random( off.height / 2 - off.height * br / 2, off.height / 2 + off.height * br / 2 ) );
			// loc = createVector( width/2, height/2 );
	
			// CEM.print("location:");
			CEM.print( "     x: " + p5.nf( loc.x, 1, 1 ) );
			CEM.print( "     y: " + p5.nf( loc.y, 1, 1 ) );
	
			CEM.print( "     r: " + p5.nf( p5.int(rot)*Math.PI, 1, 2 ) + " rads");
			CEM.print( "     s: " + p5.nf( scal, 1, 2 ) + " %");
		}
	}
	
	function addBase() {
	
		off.push();
		off.translate( off.width / 2, off.height / 2 );
		off.scale( scal ); //Scale from Center
		off.translate( off.width / -2, off.height / -2 );
	
		off.translate( 0, centerShift ); //Center
		off.translate( loc.x, loc.y ); //Position
		off.translate( 0, floorSpacing * basement ); //Floors
	
		if (rot) off.rotate( Math.PI );
		off.rotate( Math.PI ); //basements are backwards
		if (flip) off.scale(-1, 1);
		off.translate( -img.width / 2, -img.height / 2 );
	
		off.blend( img, 0, 0, img.width, img.height, 0, 0, img.width, img.height, blendSetting );
		off.pop();
	
		basement++;
	
		if ( basement < basementsInBuilding ) {
			//next basement
			CEM.newTimer( addBase, skipCheck(stepDelay) );
		} else {
			//start floors
			CEM.newTimer( addFloor, skipCheck(stepDelay) );
		}
	}
	
	function addFloor() {
	
		off.push();
		if ( fade ) off.rect( 0, 0, off.width, off.height );
	
		off.translate( off.width / 2, off.height / 2 );
		off.scale( scal ); //Scale from Center
		off.translate( off.width / -2, off.height / -2 );
	
		off.translate( 0, centerShift ); //Center
		off.translate( loc.x, loc.y ); //Position
		off.translate( 0, -floorSpacing * floor ); //Floors
	
		//Debug
		if (debugPositions) {
			off.stroke(255, 0, 0);
			if (flip) off.stroke(0, 255, 0);
			if (rot) off.stroke(0, 0, 255);
			if (rot && flip) off.stroke(0, 255, 255);
			off.strokeWeight(30);
			off.point(0,0);
		}
	
		if (rot) off.rotate( Math.PI );
		if (flip) off.scale(-1, 1);
		off.translate( -img.width / 2, -img.height / 2 );
	
		off.blend( img, 0, 0, img.width, img.height, 0, 0, img.width, img.height, blendSetting );
		off.pop();
	
		floor++;
	
		if ( floor < floorsInBuilding ) {
			//next floor
			CEM.newTimer( addFloor, skipCheck(stepDelay) );
		} else if ( building < buildingsInSet ) {
			//new building
			CEM.newTimer( startBuilding, skipCheck(buildingDelay) );
		} else {
			//kill/reset
			continu();
		}
	}
	
	function continu() {
		if ( autoContinue ) {
			if ( newSet ) {
	
				CEM.newTimer( function () {
	
					if ( setSwitch ) lighterOrDarker = !lighterOrDarker;
	
					if ( setFade ) {
						var it = 60;
						for ( var i = 0; i < it; i++ ) {
							CEM.newTimer( function () {
								off.fill( bg, 20 );
								off.rect( 0, 0, width, height );
							}, skipCheck( 1000 / 24 * i ) );
						}
						CEM.newTimer( function () {
							if ( reloadURL ) location.reload();
							else startSet();
						}, skipCheck( 1000 / 24 * it ) );
	
					} else {
	
						if ( reloadURL ) location.reload();
	
						else startSet(); //just keep going...
	
					}
				}, skipCheck(newSetDelay) );
	
			}
			else CEM.newTimer( startBuilding, skipCheck(buildingDelay) );
	
		}
	}

	function skipCheck(delay_) {
		//For headstart, shortcut timers with 0ms
		//For speedrun, don't shortcut timers but move quick at 1ms
		return (headstartBuild && buildingsCount < headstartNumBuildings) ? 0 : ((speedrun) ? 1 : delay_);
	}

	// INTERACTION /////////////////////////////////////////////////////////////////////////

	p5.mousePressed = () => {
		switch (p5.mouseButton) {
			case p5.LEFT:
				
				break;
		
			case p5.RIGHT:

				break;
		
			default:
				break;
		}

		// prevent default
		//return false;
	}

	p5.touchStarted = () => {
		// prevent default
		//return false;
	}

	p5.keyPressed = () => {
		switch ( p5.keyCode ) {
			case 82: // r
				if (headstartBuild && headstartProgress < 1) break;
				init2();
				break;
			case 83: // s
				download = true;
				break;
			case 84: // t
				speedrun = true;
				break;
		}
	}

	p5.keyReleased = () => {
		switch ( p5.keyCode ) {
			case 84: // t
				speedrun = false;
				break;
		}
	}

}

const instance = new p5(sketch, document.body)