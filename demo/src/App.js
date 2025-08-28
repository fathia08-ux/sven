/* 

  BSD License:

  SVEN: Storyline Visualization Library and Demonstration

  Copyright ©️ 2017, Battelle Memorial Institute
  All rights reserved.

  1. Battelle Memorial Institute (hereinafter Battelle) hereby grants permission
     to any person or entity lawfully obtaining a copy of this software and
     associated documentation files (hereinafter “the Software”) to redistribute
     and use the Software in source and binary forms, with or without 
     modification.  Such person or entity may use, copy, modify, merge, publish,
     distribute, sublicense, and/or sell copies of the Software, and may permit
     others to do so, subject to the following conditions:

     * Redistributions of source code must retain the above copyright notice,
       this list of conditions and the following disclaimers.
     * Redistributions in binary form must reproduce the above copyright notice,
       this list of conditions and the following disclaimer in the documentation
       and/or other materials provided with the distribution.
     * Other than as used herein, neither the name Battelle Memorial Institute
       or Battelle may be used in any form whatsoever without the express
       written consent of Battelle. 

  2. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
     AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
     THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
     PURPOSEARE DISCLAIMED. IN NO EVENT SHALL BATTELLE OR CONTRIBUTORS BE LIABLE
     FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
     DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
     SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
     CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
     LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
     OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
     DAMAGE.
     
*/

import React, { Component } from 'react';

import {Map, Set} from 'immutable';

import {scaleOrdinal, schemeCategory10} from 'd3-scale';
import {min, max} from 'd3-array';

import moment from 'moment';

import Typography from '@material-ui/core/Typography';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import List from '@material-ui/core/List';
import ListSubheader from '@material-ui/core/ListSubheader';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Checkbox from '@material-ui/core/Checkbox';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';

import Select from 'react-select-2';
import 'react-select-2/dist/css/react-select-2.css';

import events from './data/jonas-events.json';
import employeesData from './data/jonas-characters.json';

import StorylineChart, {SvenLayout} from '../../src';

import './App.css';

// Create a layout that respects our custom character ordering
const createLayout = (orderedCharacters) => {
  // Create a mapping from character name to position index
  const characterOrder = {};
  orderedCharacters.forEach((name, index) => {
    characterOrder[name] = index;
  });
  
  return SvenLayout()
    .time(d => parseInt(d.date))
    .id(d => d.name)
    .group(d => d.name);
};

const color = scaleOrdinal(schemeCategory10);

// Family-based color key helper: same family (last name) shares a color
// EXCEPT Jonas and Martha who each get unique colors not shared with others.
const familyColorKey = key => {
  if (key.includes(' Group')) return key; // activity grouping keeps distinct color
  if (key.startsWith('Jonas Kahnwald')) return 'JonasUnique';
  if (key.startsWith('Martha Nielsen')) return 'MarthaUnique';
  // Take first segment before slash (alias separator)
  let base = key.split(' / ')[0];
  base = base.replace(/\(.*?\)/g, '').trim();
  const parts = base.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last === 'Kahnwald') return 'KahnwaldFamily'; // group all Kahnwald except Jonas
  if (last === 'Nielsen') return 'NielsenFamily';   // group all Nielsens except Martha
  return last; // other families map directly
};

const familyColorScale = scaleOrdinal()
  .domain([]) // will grow as needed
  .range(schemeCategory10);

const employees = Map(employeesData);

const employeesByType = Map().withMutations(map =>
  employees.map((v,k) => map.setIn([v,k], true))
);

const CharacterList = ({data, onClick}) =>
  <List>
    { data.keySeq().sort().map(k =>
        <ListItem button dense key={k} onClick={e => onClick(k, data.get(k), e.shiftKey)}>
          <Avatar style={{backgroundColor: familyColorScale(familyColorKey(k))}}>
            {data.get(k).size}
          </Avatar>
          <ListItemText primary={k}/>
        </ListItem>
      )
    }
  </List>

const asSelectList = map =>
  map.keySeq()
    .sort()
    .map(value => ({value, label: value}))
    .toArray();

const DELIIMTER = ';';

const CharacterSelect = ({data, onChange}) =>
  <Select simpleValue multi delimiter={DELIIMTER}
    options={asSelectList(data.filter(v => !v))}
    value={asSelectList(data.filter(v => v))}
    onChange={onChange}
  />

const DatesSelect = ({data, onChange}) =>
  <div className='dates-component noselect'>
    { data.keySeq().sort().map(k =>
        <div
          key={k}
          onClick={e => onChange(k, !data.get(k), e.shiftKey)}
          className={'date' + (data.get(k) ? ' selected' : '')}
        >
          {k} 
        </div>
      )
    }
  </div>

// Include all the Jonas timeline years
const jonasAllowedYears = ['1888', '1890', '1904', '1910', '1911', '1920', '1921', '1953', '1954', '1971', '1986', '1987', '2019', '2020', '2021', '2023', '2040', '2041', '2052', '2053'];
const dates = Map(jonasAllowedYears.map(year => [year, false]));

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      people: employees.map(() => false),
      dates: dates.map(() => true) // Select all years by default
    };
    this.chartRef = React.createRef();
  }
  
  componentDidMount() {
    // Force the order after component mounts
    setTimeout(() => {
      this.forceOrderAfterRender();
    }, 500);
  }
  
  forceOrderAfterRender() {
    console.log('Forcing order after render...');
    
    // Get all the path elements (character lines) and text labels
    const paths = document.querySelectorAll('.storylines-chart path');
    const labels = document.querySelectorAll('.storylines-chart text');
    
    console.log('Found paths:', paths.length);
    console.log('Found labels:', labels.length);
    
    // Create a mapping for the exact order
    const orderMap = {};
    this.state.orderedCharacters.forEach((char, index) => {
      orderMap[char] = index;
    });
    
    // Force the order by modifying the DOM for both paths and labels
    paths.forEach((path, index) => {
      const transform = path.getAttribute('transform');
      if (transform) {
        // Extract current y position and force it to our order
        const match = transform.match(/translate\([^,]+,\s*([^)]+)\)/);
        if (match) {
          const forcedY = index * 200;
          const newTransform = transform.replace(/translate\([^,]+,\s*[^)]+\)/, `translate(0, ${forcedY})`);
          path.setAttribute('transform', newTransform);
        }
      }
    });
    
    // Also force the order for text labels
    labels.forEach((label, index) => {
      const currentY = label.getAttribute('y');
      if (currentY) {
        const forcedY = index * 200;
        label.setAttribute('y', forcedY);
      }
    });
    
    console.log('DOM order forced for both paths and labels');
  }

  // --- Added: SVG export helpers (Option 1) ---
  inlineStyles = (svg) => {
    // svg here is the clone we will serialize. We need computed styles from the on-screen original
    const original = document.querySelector('svg.storylines-chart');
    if (!original) return;

    // If the passed svg IS the original (fallback), use it directly
    const getSourceElement = el => {
      if (svg === original) return el; // same reference
      // Match by index order
      // Build a map only once
      if (!this._origElements) {
        this._origElements = Array.from(original.querySelectorAll('*'));
        this._cloneElements = Array.from(svg.querySelectorAll('*'));
      }
      const idx = this._cloneElements.indexOf(el);
      return this._origElements[idx] || el; // fallback
    };

    const PROPS = [
      'fill','fill-opacity','stroke','stroke-width','stroke-opacity',
      'font','font-size','font-family','font-weight','opacity',
      'stroke-linecap','stroke-linejoin','stroke-dasharray'
    ];

    svg.querySelectorAll('*').forEach(el => {
      const source = getSourceElement(el);
      const cs = window.getComputedStyle(source);
      const decls = [];
      PROPS.forEach(p => {
        let val = cs.getPropertyValue(p);
        if (!val || val === 'initial') return; // skip empty
        // Some browsers return rgb(...), keep as-is
        decls.push(`${p}:${val.trim()}`);
        // Also set attribute for fill/stroke so tools that ignore style still work
        if (p === 'fill' && val) el.setAttribute('fill', val.trim());
        if (p === 'stroke' && val) el.setAttribute('stroke', val.trim());
      });
      if (decls.length) el.setAttribute('style', decls.join(';')); else el.removeAttribute('style');
    });
  }

  handleDownloadSVG = () => {
    const svg = document.querySelector('svg.storylines-chart');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const bb = svg.getBBox();
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`);
    // Inline styles using original as reference
    this.inlineStyles(clone);
    const blob = new Blob([clone.outerHTML], {type:'image/svg+xml;charset=utf-8'});
    const a = document.createElement('a');
    a.download = 'storylines.svg';
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
  // --- End added code ---

  handleCharacterTypeClick = (k, v, append) => {
    if (append) {
      this.setState({people: this.state.people.merge(v)});
    } else {
      this.setState({people: this.state.people.map((_,k) => v.has(k))});
    }
  }

  handleCharacterChange = value => {
    const selection =  Set(value.split(DELIIMTER));
    this.setState({
      people: this.state.people.map((_,k) => selection.has(k))
    });
  }

  handleCharacterClick = values => {
    const selection = Set(values.map(d => d.name));
    this.setState({
      people: this.state.people.map((v, k) => selection.has(k))
    });
  }

  handleDateChage = (k, v, append) => {
    this.setState({
      dates: append
        ? this.state.dates.set(k, v)
        : this.state.dates.map((_,k2) => k === k2)
    });
  }

  render() {
    // Use all characters and all dates - no filtering, but exclude characters with no events and Bernd Doppler
    const allCharacters = Object.keys(employeesData).filter(characterName => {
      // Exclude Bernd Doppler
      if (characterName === 'Bernd Doppler (J)') return false;
      
      // Check if this character appears in any events
      return events.some(event => {
        if (!event.name) return false;
        const eventChars = event.name.split(', ').map(name => name.trim());
        return eventChars.includes(characterName);
      });
    });
    
    console.log('All characters found:', allCharacters);
    console.log('Total characters:', allCharacters.length);
    const allYears = Array.from(new Set(events.map(d => d.date)));
    
    // First, calculate interaction counts for all characters
    const characterInteractionCounts = {};
    allCharacters.forEach(name => {
      characterInteractionCounts[name] = {};
      allCharacters.forEach(otherName => {
        if (name !== otherName) {
          characterInteractionCounts[name][otherName] = 0;
        }
      });
    });
    
    // Find events where multiple characters appear together
    const eventsWithMultipleCharacters = events.filter(event => {
      if (!event.name || event.name.trim() === '') return false;
      const characterNames = event.name.split(', ').map(name => name.trim());
      return characterNames.length > 1;
    });
    
    // Count interactions between each pair of characters
    eventsWithMultipleCharacters.forEach(event => {
      const characterNames = event.name.split(', ').map(name => name.trim());
      for (let i = 0; i < characterNames.length; i++) {
        for (let j = i + 1; j < characterNames.length; j++) {
          const char1 = characterNames[i];
          const char2 = characterNames[j];
          if (characterInteractionCounts[char1] && characterInteractionCounts[char2]) {
            characterInteractionCounts[char1][char2]++;
            characterInteractionCounts[char2][char1]++;
          }
        }
      }
    });
    
    // Calculate total interactions per character
    const characterTotalInteractions = {};
    allCharacters.forEach(char => {
      const interactions = characterInteractionCounts[char] || {};
      characterTotalInteractions[char] = Object.values(interactions).reduce((sum, count) => sum + (count || 0), 0);
    });
    
    // Filter out characters with less than 10 interactions
    const charactersWithEnoughInteractions = allCharacters.filter(char => {
      const interactionCount = characterTotalInteractions[char] || 0;
      return interactionCount >= 10;
    });
    
    console.log('Characters with 10+ interactions:');
    charactersWithEnoughInteractions.forEach(char => {
      const count = characterTotalInteractions[char] || 0;
      console.log(`${char}: ${count} interactions`);
    });
    
    console.log('\n=== CHARACTERS NOT INCLUDED (less than 10 interactions) ===');
    allCharacters.forEach(char => {
      if (!charactersWithEnoughInteractions.includes(char)) {
        const count = characterTotalInteractions[char] || 0;
        console.log(`${char}: ${count} interactions (EXCLUDED)`);
      }
    });
    
    // Order characters by their first appearance in the timeline
    const characterFirstAppearance = {};
    
    // For each character, find the earliest year they appear
    charactersWithEnoughInteractions.forEach(characterName => {
      let earliestYear = Infinity;
      
      events.forEach(event => {
        if (event.name && event.name.includes(characterName)) {
          const year = parseInt(event.date);
          if (year < earliestYear) {
            earliestYear = year;
          }
        }
      });
      
      characterFirstAppearance[characterName] = earliestYear;
    });
    
    // Custom character order from top to bottom of the graph
    const customCharacterOrder = [
      'Magnus Nielsen (J)',
      'Martha Nielsen / Eve (M)',
      'Jonas Kahnwald / Adam (J)',
      'Bartosz Tiedemann (J)',
      'Charlotte Doppler (J)',
      'Agnes',
      'Noah / Hanno Tauber (J)',
      'Helge Doppler (J)',
      'Mikkel Nielsen / Michael Kahnwald (J)',
      'Erik Obendorf (J)',
      'Ulrich Nielsen (J)',
      'Tronte Nielsen (J)',
      'Elisabeth Doppler (J)',
      'Mads Nielsen (J)',
      'Regina Tiedemann (J)'
    ];
    
    console.log('\n=== CHARACTER NAME COMPARISON ===');
    console.log('Custom order characters:');
    customCharacterOrder.forEach((char, index) => {
      const hasEnoughInteractions = charactersWithEnoughInteractions.includes(char);
      const interactionCount = characterTotalInteractions[char] || 0;
      console.log(`${index + 1}. ${char} - Has 10+ interactions: ${hasEnoughInteractions} (${interactionCount} interactions)`);
    });
    
    // Filter to only include characters that have enough interactions
    const orderedCharacters = customCharacterOrder.filter(char => 
      charactersWithEnoughInteractions.includes(char)
    );
    
    // Add any remaining characters with enough interactions that weren't in the custom order
    charactersWithEnoughInteractions.forEach(char => {
      if (!orderedCharacters.includes(char)) {
        orderedCharacters.push(char);
      }
    });
    
    console.log('Characters ordered by first appearance (chronological):');
    orderedCharacters.forEach((char, index) => {
      console.log(`${index + 1}. ${char} (first appears in ${characterFirstAppearance[char]})`);
    });
    
    console.log('\nCharacters with enough interactions:');
    charactersWithEnoughInteractions.forEach((char, index) => {
      console.log(`${index + 1}. ${char}`);
    });
    
    console.log('\nChecking for name mismatches...');
    const missingFromOrder = charactersWithEnoughInteractions.filter(char => !orderedCharacters.includes(char));
    const missingFromInteractions = orderedCharacters.filter(char => !charactersWithEnoughInteractions.includes(char));
    
    if (missingFromOrder.length > 0) {
      console.log('Characters in interactions but not in order:', missingFromOrder);
    }
    if (missingFromInteractions.length > 0) {
      console.log('Characters in order but not in interactions:', missingFromInteractions);
    }
    
    console.log('\nFinal orderedCharacters array:');
    orderedCharacters.forEach((char, index) => {
      console.log(`${index + 1}. ${char}`);
    });
    
    console.log('\n=== CUSTOM ORDER VERIFICATION ===');
    console.log('Custom order length:', customCharacterOrder.length);
    console.log('Ordered characters length:', orderedCharacters.length);
    console.log('Characters with enough interactions length:', charactersWithEnoughInteractions.length);
    console.log('Custom order matches ordered characters:', JSON.stringify(customCharacterOrder.slice(0, orderedCharacters.length)) === JSON.stringify(orderedCharacters));
    
    // Now create filled data with only characters that have 10+ interactions
    const filledData = [];
    console.log('\n=== PROCESSING EVENTS FOR FILTERED CHARACTERS ===');
    charactersWithEnoughInteractions.forEach(name => {
      allYears.forEach(date => {
        // Find ALL events where this character appears (either alone or with others)
        const characterEvents = events.filter(d => {
          if (!d.name) return false;
          const characterNames = d.name.split(', ').map(n => n.trim());
          return characterNames.includes(name) && d.date === date;
        });
        
        if (characterEvents.length > 0) {
          // Process all events for this character in this year
          characterEvents.forEach(event => {
            const characterNames = event.name.split(', ').map(n => n.trim());
            const isMultiCharacterEvent = characterNames.length > 1;
            
            // Only include multi-character events (interactions)
            if (isMultiCharacterEvent) {
              filledData.push({
                ...event,
                name, // Use the individual character name for the data point
                date
              });
            }
            // Remove all single-character events - don't include them at all
          });
        }
        // Remove empty data points - don't add them at all
      });
    });

    // Preprocess: for each year, find events where multiple characters interact
    const interactionByYear = {};
    allYears.forEach(year => {
      interactionByYear[year] = {};
      charactersWithEnoughInteractions.forEach(name => {
        interactionByYear[year][name] = []; // Initialize with empty array for multiple interactions
      });
    });
    
    // Process each event with multiple characters
    eventsWithMultipleCharacters.forEach((event, eventIndex) => {
      const year = event.date;
      const characterNames = event.name.split(', ').map(name => name.trim());
      
      // Debug: log 1953 events
      if (year === '1953') {
        console.log(`1953 Event ${eventIndex}: ${event.name} - "${event.description}"`);
        console.log(`  Characters in this event: ${characterNames.join(', ')}`);
      }
      
      // Create a unique interaction ID for this specific event
      const interactionId = `interaction_${year}_${eventIndex}_${characterNames.sort().join('_')}`;
      
      // Assign this interaction to all characters in the event
      characterNames.forEach(name => {
        if (interactionByYear[year][name] !== undefined) {
          interactionByYear[year][name].push(interactionId);
          if (year === '1953') {
            console.log(`  Assigned interaction ${interactionId} to ${name}`);
          }
        } else {
          if (year === '1953') {
            console.log(`  WARNING: ${name} not found in interactionByYear[${year}]`);
          }
        }
      });
    });
    

    
    // Debug: log the final ordering
    console.log('Final character order (chronological):');
    orderedCharacters.forEach((char, index) => {
      console.log(`${index + 1}. ${char} (first appears in ${characterFirstAppearance[char]})`);
    });
    
    // Assign y positions based on exact order
    const yPositions = {};
    
    // Assign positions to characters in chronological order (earliest first)
    orderedCharacters.forEach((name, i) => {
      yPositions[name] = i * 200;
    });
    
    // Also assign positions to any characters that might be missing
    charactersWithEnoughInteractions.forEach((name, i) => {
      if (!yPositions.hasOwnProperty(name)) {
        yPositions[name] = (orderedCharacters.length + i) * 200;
      }
    });
    
    console.log('\nLine positions (top to bottom):');
    orderedCharacters.forEach((name, i) => {
      console.log(`Position ${i}: ${name}`);
    });
    
    // Debug: log the y positions
    console.log('Y positions assigned:');
    Object.entries(yPositions).slice(0, 10).forEach(([char, pos]) => {
      console.log(`${pos}: ${char}`);
    });
    
    // Debug: check if yPositions is being used correctly
    console.log('First 5 characters in yPositions:', Object.keys(yPositions).slice(0, 5));
    
    // For each year, if multiple characters are in the same interaction, set their y to midpoint
    const customY = {};
    allYears.forEach(year => {
      const interactionCounts = {};
      
      // Count characters in each interaction
      orderedCharacters.forEach(name => {
        const interactions = interactionByYear[year][name];
        if (interactions && interactions.length > 0) {
          interactions.forEach(interaction => {
            if (!interactionCounts[interaction]) interactionCounts[interaction] = [];
            interactionCounts[interaction].push(name);
          });
        }
      });
      
      orderedCharacters.forEach(name => {
        let y;
        const interactions = interactionByYear[year][name];
        
        // Always use the original y position to maintain our forced order
        y = yPositions[name];
        
        if (!customY[year]) customY[year] = {};
        customY[year][name] = y;
      });
    });
    
    // Modify character names to include their position in the chronological order
    const characterPositionMap = {};
    orderedCharacters.forEach((name, index) => {
      characterPositionMap[name] = index;
    });
    
    filledData.forEach(d => {
      d._customY = customY[d.date][d.name];
      
      // Override the y-position to use our custom ordering
      d.y = customY[d.date][d.name];
      
      // Temporarily modify the name to include position for sorting
      const position = characterPositionMap[d.name] || 999; // Use 999 for characters not in hardcoded order
      d._originalName = d.name;
      d.name = `${position.toString().padStart(3, '0')}_${d.name}`;
      
      // Add event description for tooltips
      const event = events.find(ev => {
        if (!ev.name) return false;
        const eventChars = ev.name.split(', ').map(name => name.trim());
        return ev.date === d.date && eventChars.includes(d._originalName);
      });
      
      if (event) {
        d._eventDescription = event.description;
        d._eventCharacters = event.name;
        d._eventImportant = event.important;
        d._eventDeath = event.death;
      } else {
        d._eventDescription = '';
        d._eventCharacters = '';
        d._eventImportant = false;
        d._eventDeath = false;
      }
    });

        // Create layout with forced order
    const layout = createLayout(orderedCharacters);
    
    // Use custom group accessor (for color/label) based on interactions
    const storylines = layout
      .group(d => {
        const originalName = d._originalName || d.name.replace(/^\d{3}_/, '');
        const interactions = interactionByYear[d.date][originalName];
        if (interactions && interactions.length > 0) {
          // Find the most significant interaction (with most characters)
          const interactionCounts = {};
          orderedCharacters.forEach(name => {
            const charInteractions = interactionByYear[d.date][name];
            if (charInteractions && charInteractions.length > 0) {
              charInteractions.forEach(interaction => {
                if (!interactionCounts[interaction]) interactionCounts[interaction] = [];
                interactionCounts[interaction].push(name);
              });
            }
          });
          
          let bestInteraction = interactions[0];
          let maxCharacters = 0;
          
          interactions.forEach(interaction => {
            const charCount = interactionCounts[interaction] ? interactionCounts[interaction].length : 0;
            if (charCount > maxCharacters) {
              maxCharacters = charCount;
              bestInteraction = interaction;
            }
          });
          
          if (maxCharacters > 1) {
            const charsInInteraction = interactionCounts[bestInteraction];
            // Get the event description for this interaction
            const event = eventsWithMultipleCharacters.find(ev => {
              const eventChars = ev.name.split(', ').map(name => name.trim());
              return ev.date === d.date && 
                     eventChars.length === charsInInteraction.length &&
                     eventChars.every(char => charsInInteraction.includes(char));
            });
            // Create a cleaner group label for interactions
            if (event) {
              const shortDesc = event.description.length > 30 ? 
                event.description.substring(0, 30) + '...' : 
                event.description;
              return `🔗 ${event.date}: ${shortDesc}`;
            }
            return `🔗 Interaction Group`;
          } else {
            return d.name;
          }
        } else {
          return d.name;
        }
      })
      (filledData);
    
    // FORCE THE ORDER by sorting the interactions array
    if (storylines && storylines.interactions) {
      console.log('Forcing custom order by sorting interactions...');
      console.log('Custom order:', orderedCharacters);
      
      // Create a mapping for the custom order
      const orderMap = {};
      orderedCharacters.forEach((char, index) => {
        orderMap[char] = index;
      });
      
      console.log('Order map:', orderMap);
      
      // Sort the interactions array to match our custom order
      console.log('Before sorting - interaction keys:', storylines.interactions.map(i => i.key));
      
      storylines.interactions.sort((a, b) => {
        // Extract the original character name from the prefixed key
        const aName = a.key.replace(/^\d{3}_/, '');
        const bName = b.key.replace(/^\d{3}_/, '');
        
        // Get the position from the prefix (first 3 digits)
        const aPrefix = a.key.match(/^(\d{3})_/);
        const bPrefix = b.key.match(/^(\d{3})_/);
        
        const aOrder = aPrefix ? parseInt(aPrefix[1]) : 999;
        const bOrder = bPrefix ? parseInt(bPrefix[1]) : 999;
        
        console.log(`Comparing: ${aName} (prefix: ${aPrefix ? aPrefix[1] : 'none'}, order: ${aOrder}) vs ${bName} (prefix: ${bPrefix ? bPrefix[1] : 'none'}, order: ${bOrder})`);
        
        return aOrder - bOrder;
      });
      
      console.log('Interactions sorted to custom order:', storylines.interactions.map(i => i.key.replace(/^\d{3}_/, '')));
      
      // Force y-positions to match our custom order exactly
      storylines.interactions.forEach((interaction, index) => {
        // Extract the position from the character name prefix
        const prefix = interaction.key.match(/^(\d{3})_/);
        const position = prefix ? parseInt(prefix[1]) : index;
        
        // Use the position from our custom order, not the array index
        const baseY = position * 200; // Base position for this character
        interaction.y0 = baseY;
        interaction.y1 = baseY + 100;
        
        console.log(`Setting ${interaction.key.replace(/^\d{3}_/, '')} to position ${position}, y=${baseY}`);
        
        // Update all data points in this interaction to base position
        interaction.values.forEach(value => {
          value.values.forEach(point => {
            point.y = baseY;
          });
        });
        
        // Update the first value's y position for label positioning
        if (interaction.values && interaction.values[0] && interaction.values[0].values && interaction.values[0].values[0]) {
          interaction.values[0].values[0].y = baseY;
        }
      });
      
      console.log('Y-positions forced for all interactions');
    }


    

    console.log('Storylines data:', storylines);
    console.log('Number of interactions:', storylines.interactions ? storylines.interactions.length : 0);
    
    const ymin = min(storylines.interactions, d => d.y0);
    const ymax = max(storylines.interactions, d => d.y1);
    
    return (
      <div style={{padding: '20px', width: '100%', margin: '0 auto', overflowX: 'auto', minWidth: '6000px'}}>
        <div style={{display:'flex', justifyContent:'space-between', padding:'8px', marginBottom: '10px'}}>
          <div style={{fontSize: '14px', color: '#666'}}>
            <strong>Data Summary:</strong> {allCharacters.length} characters, {events.length} total events, {eventsWithMultipleCharacters.length} interactions
            <div style={{marginTop: '5px', fontSize: '12px'}}>
              <span style={{color: '#e74c3c'}}>🔗 Red lines</span> = Character interactions | 
              <span style={{color: '#666'}}>Colored lines</span> = Individual character storylines
            </div>
          </div>
          <button 
            onClick={this.handleDownloadSVG}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Download SVG
          </button>
        </div>
        <div style={{width: '6000px', overflowX: 'auto'}}>
                  <StorylineChart
          ref={this.chartRef}
          key={orderedCharacters.join(',')} // Force re-render when order changes
          xAxisData={jonasAllowedYears}
          data={storylines}
          width={6000}
          height={1149}
          color={d => {
            // Use different colors for interactions vs individual characters
            if (d.key.includes('🔗')) {
              return '#e74c3c'; // Red for interactions
            }
            return familyColorScale(familyColorKey(d.key));
          }}
          lineLabel={d => {
            // Remove the position prefix for display
            const key = d.key;
            if (key && key.includes('_')) {
              return key.split('_').slice(1).join('_');
            }
            return key;
          }}
          lineTitle={d => {
            // Create a cleaner tooltip with event information
            const events = d.values.map(v => v.data).filter(data => data._eventDescription);
            if (events.length > 0) {
              const eventInfo = events.map(event => {
                const status = event._eventImportant ? ' ⚠️' : '';
                const death = event._eventDeath ? ' 💀' : '';
                const isInteraction = event._eventCharacters && event._eventCharacters.includes(',');
                const interactionIcon = isInteraction ? '🔗 ' : '';
                return `${interactionIcon}${event.date}: ${event._eventDescription}${status}${death}`;
              }).join('\n');
              return `${d.key}\n\n${eventInfo}`;
            }
            return d.key;
          }}
          groupLabel={d => d.key}
          />
        </div>
        
        {/* Debug Information */}
        <details style={{marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
          <summary style={{cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'}}>
            📊 Debug Information - All Characters and Events (Click to expand)
          </summary>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px'}}>
            {orderedCharacters.map(character => {
              const characterEvents = events.filter(event => {
                if (!event.name) return false;
                const eventChars = event.name.split(', ').map(name => name.trim());
                return eventChars.includes(character);
              });
              const interactionEvents = characterEvents.filter(event => {
                const eventChars = event.name.split(', ').map(name => name.trim());
                return eventChars.length > 1;
              });
              const singleEvents = characterEvents.filter(event => {
                const eventChars = event.name.split(', ').map(name => name.trim());
                return eventChars.length === 1;
              });
              
              return (
                <div key={character} style={{border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: 'white'}}>
                  <strong>{character}</strong><br/>
                  Total Events: {characterEvents.length}<br/>
                  Interactions: {interactionEvents.length}<br/>
                  Single Events: {singleEvents.length}<br/>
                  <details style={{marginTop: '5px'}}>
                    <summary style={{cursor: 'pointer', fontSize: '12px'}}>Show Events</summary>
                    <div style={{fontSize: '11px', maxHeight: '100px', overflowY: 'auto'}}>
                      {characterEvents.map((event, index) => (
                        <div key={index} style={{marginBottom: '2px', padding: '2px', backgroundColor: '#f9f9f9'}}>
                          <strong>{event.date}:</strong> {event.description.substring(0, 60)}...
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    );
	}
}

export default App;