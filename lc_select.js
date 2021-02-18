/**
 * lc_select.js - Superlight Javascript dropdowns
 * Version: 1.0
 * Author: Luca Montanari aka LCweb
 * Website: https://lcweb.it
 * Licensed under the MIT license
 */


(function() { 
	"use strict";
    if(typeof(window.lc_select) != 'undefined') {return false;} // prevent multiple script inits  
    
    
    /*** vars ***/
    let debounced_vars  = [],

        style_generated = null,
        active_trigger  = null;
    
    
    
    /*** default options ***/
    const def_opts = {
        enable_search   : true, // (bool) whether to enable fields search
        min_for_search  : 7, // (int) minimum options number to show search  
        wrap_width      : 'auto', // (string) defines the wrapper width: "auto" to leave it up to CSS, "inherit" to statically copy input field width, or any other CSS sizing 
        addit_classes   : [], // (array) custom classes assigned to the field wrapper (.lcslt-wrap) and dropdown (#lc-select-dd)
        pre_placeh_opt  : false, // (bool) if true, on simple dropdowns without a selected value, prepend an empty option using placeholder text
        max_opts        : false, // (int|false) defining maximum selectable options for multi-select
        on_change       : null, // function(new_value, target_field) {}, - triggered every time field value changes. Passes value and target field object as parameters
        
        labels          : [ // (array) option used to translate script texts
            'search options',
            'add options',
            'Select options ..',
            '.. no matching options ..',
        ],
    };
    
    
    
    
    /*** hide dropdown cicking outside ***/
    document.addEventListener('click', function(e) {
        const dd = document.querySelector("#lc-select-dd.lcslt-shown");
        if(!dd) {
            return true;    
        }
        
        // is an element within a trigger?
        for (const trigger of document.getElementsByClassName('lcslt-wrap')) {
            if(trigger.contains(e.target)) {
                return true; 
            }    
        }

        // close if clicked element is not in the dropdown
        if(!dd.contains(e.target) && !e.target.classList.contains('lcslt-shown')) {
            dd.remove();
            
            if(active_trigger) {
                active_trigger.classList.remove('lcslt_dd-open');
                active_trigger = null;
            }
        }
        return true;
    });
    
    
    /* hide dropdown on screen resizing */
    window.addEventListener('resize', function(e) {
        const dd = document.querySelector("#lc-select-dd.lcslt-shown");
        if(!dd) {
            return true;    
        }
        
        // avoid closing if on mobile and searching
        if(document.activeElement.hasAttribute('type') && document.activeElement.getAttribute('type') === 'text') {
            return true;    
        }

        dd.classList.remove('lcslt-shown');
        active_trigger.classList.remove('lcslt_dd-open');
        active_trigger = null;
        
        return true;
    });
    

    
    
    
    /*** plugin class ***/
    window.lc_select = function(attachTo, options = {}) {
        if(!attachTo) {
            return console.error('You must provide a valid selector or DOM object as first argument');
        }
    
        // override options
        if(typeof(options) !=  'object') {
            return console.error('Options must be an object');    
        }
        options = Object.assign({}, def_opts, options);
        
        
        /* initialize */
        this.init = function() {
            const $this = this;
            
            // Generate style
            if(!style_generated) {
                this.generate_style();
                style_generated = true;
            }
           
            // assign to each target element
            maybe_querySelectorAll(attachTo).forEach(function(el) {
                if(el.tagName != 'SELECT') {
                    return;    
                }
                
                // do not initialize twice
                if(el.parentNode.classList.length && el.parentNode.classList.contains('lcslt_wrap')) {
                    return;    
                }

                $this.wrap_element(el);
                
                
                // hook to update LC select implementation of select fields (eg. when new fields are )
                el.addEventListener('lc-select-refresh', (e) => {
                    
                    // close eventually opened dropdowns
                    if(active_trigger) {
                        active_trigger.click();    
                    }
                    
                    const trigger = e.target.parentNode.querySelector('.lcslt');
                    $this.set_sel_content(trigger);
                    
                    // track disabled status
                    console.log(e.target.disabled);
                    (e.target.disabled) ? trigger.classList.add('lcslt-disabled') : trigger.classList.remove('lcslt-disabled'); 
                    
                    return true;
                });
                
                
                // hook destroying LC select implementation of select fields
                el.addEventListener('lc-select-destroy', (e) => {
                    
                    // close eventually opened dropdowns
                    if(active_trigger) {
                        active_trigger.click();    
                    }
                    
                    const select    = e.target,
                          wrap      = e.target.parentNode,
                          fake_opt  = select.querySelector('option[data-lcslt-placeh="1"]');

                    if(fake_opt) {
                        fake_opt.remove();    
                    }
                    
                    wrap.parentNode.insertBefore(select, wrap);  
                    wrap.remove();
                    
                    return true;
                });
            });
        };
    
        
        
        /* wrap target element to allow trigger display */
        this.wrap_element = function(el) {
            const $this         = this,
                  div           = document.createElement('div'),
                  fname_class   = 'lcslt-f-'+ el.getAttribute('name').replace(/\[\]/g, ''),
                  disabled_class= (el.disabled) ? 'lcslt-disabled' : '',
                  multi_class   = (el.multiple) ? 'lcslt-multiple' : '';
            
            // be sure there's a placeholder for multiple
            let placeh = (el.hasAttribute('data-placeholder')) ? el.getAttribute('data-placeholder').trim() : ''; 
            if(!placeh && multi_class) {
                placeh = options.labels[2];    
            }
            
            // additional classes
            if(typeof(options.addit_classes) == 'object') {
                options.addit_classes.some((aclass) => { 
                    div.classList.add( aclass );                           
                });
            }
            
            // static width from select?
            if(options.wrap_width != 'auto') {
                div.style.width = (options.wrap_width == 'inherit') ? Math.round(el.getBoundingClientRect().width) + 'px' : options.wrap_width; 
            }
            
            
            div.classList.add("lcslt-wrap");
            div.innerHTML = '<div class="lcslt '+ fname_class +' '+ multi_class +' '+ disabled_class +'" data-placeh="'+ placeh +'"></div>';

            el.parentNode.insertBefore(div, el);
            div.appendChild(el);
            
            const trigger = div.querySelector('.lcslt');
            
            
            // simple dropdown placeholder
            if(options.pre_placeh_opt && !multi_class && placeh) {
                
                // be sure no other option is selected
                let no_selected = true;
                el.querySelectorAll('option').forEach(opt => {
                    if(opt.hasAttribute('selected')) {
                        no_selected = false;
                        return false;
                    }
                });
                
                if(no_selected) {
                    const ph_opt = document.createElement('option');
                    ph_opt.setAttribute('data-lcslt-placeh', 1);
                    ph_opt.setAttribute('value', "");
                    ph_opt.style.display = 'none';
                    ph_opt.innerHTML = placeh;
                    ph_opt.selected = true;

                    el.insertBefore(ph_opt, el.firstChild);  
                }
            }
            
            
            // set content
            this.set_sel_content(trigger);
            
            // event to show dropdown
            trigger.addEventListener("click", (e) => {
                if(
                    !trigger.classList.contains('lcslt-disabled') && 
                    !e.target.classList.contains('lcslt-multi-selected') &&
                    !e.target.classList.contains('lcslt-max-opts') &&
                    !e.target.parentNode.classList.contains('lcslt-multi-selected')
                ) {
                    $this.show_dd(trigger)
                }
            }); 
        };
        
        
        
        /* Set selected content into .lcslt */
        this.set_sel_content = function(trigger = false) {
            if(!trigger) {
                trigger = active_trigger;    
            }

            const $this         = this, 
                  select        = trigger.nextSibling,
                  is_multiple   = trigger.classList.contains('lcslt-multiple');
            
            let code        = '',
                tot_opts    = 0,
                sel_opts    = 0;
            
            trigger.nextSibling.querySelectorAll('option').forEach(opt => {
                
                if(opt.selected) {
                    const img = (opt.hasAttribute('data-image')) ? '<i class="lcslt-img" style="background-image: url(\''+ opt.getAttribute('data-image').trim() +'\')"></i>' : ''; 
                        
                    if(is_multiple) {
                        code += '<div class="lcslt-multi-selected" data-val="'+ opt.getAttribute('value') +'" title="'+ opt.innerHTML +'"><span>'+ img + opt.innerHTML +'</span></div>';
                    } 
                    else {
                        const single_placeh_mode = (options.pre_placeh_opt && opt.hasAttribute('data-lcslt-placeh')) ? 'class="lcslt-placeholder"' : ''; 
                        code = '<span '+ single_placeh_mode +' title="'+ opt.innerHTML +'">'+ img + opt.innerHTML +'</span>';    
                    }
                    
                    sel_opts++;
                }
                
                tot_opts++;
            });
            
            
            // max-values limit class management
            let max_opts_reached = false;
            if(typeof(options.max_opts) == 'number' && options.max_opts > 1) {
                if(sel_opts >= options.max_opts) {
                    trigger.classList.add('lcslt-max-opts');
                    max_opts_reached = true;   
                } 
                else {
                    trigger.classList.remove('lcslt-max-opts')
                }
            }
            
            
            // nothing selected? show placeholder
            if(!code) {
                code = '<span class="lcslt-placeholder">'+ trigger.getAttribute('data-placeh') +'</span>';    
            }
            else if(is_multiple && tot_opts > sel_opts && !select.disabled && !max_opts_reached) {
                code += '<span class="lcslt-multi-callout" title="'+ options.labels[1] +'">+</span>';    
            }
            
            trigger.innerHTML = code;
            
            
            // sel opt click listener - deselect
            if(is_multiple) {
                trigger.querySelectorAll('.lcslt-multi-selected').forEach(sel_opt => { 
                    sel_opt.addEventListener("click", (e) => {
                        
                        if( !recursive_parent(e.target, '.lcslt').classList.contains('lcslt-disabled') ) {
                            $this.deselect_option(e, trigger, sel_opt);
                        }
                    });     
                });
            }
        };
        
        
        
        /* show dropdown */
        this.show_dd = function(trigger) {
            
            // close other opened dropdowns
            if(document.querySelector("#lc-select-dd")) {
                document.querySelector("#lc-select-dd").remove();     
                active_trigger.classList.remove('lcslt_dd-open');
            }
            
            // close if already opened
            if(trigger == active_trigger) {
                active_trigger = null;
                return false;
            }
            active_trigger = trigger;
            
            this.append_dd();
            this.set_dd_position();
            
            const $this = this,
                  dd = document.querySelector('#lc-select-dd');
            
            dd.classList.add('lcslt-shown');
            trigger.classList.add('lcslt_dd-open');
            
            // be sure dropdown didn't add page scrollers. In case, adjust X pos 
            setTimeout(() => {
                if(trigger.getBoundingClientRect().x != dd.getBoundingClientRect().x) {
                    $this.set_dd_position();
                }
            }, 10);
        };
        
        
        
        /* set dropdown position */
        this.set_dd_position = function() {
            const dd            = document.querySelector('#lc-select-dd'),
                  at_offset     = active_trigger.getBoundingClientRect(),
                  dd_w          = at_offset.width.toFixed(2),
                  at_vert_boders= parseInt(getComputedStyle(active_trigger)['borderTopWidth'], 10) + parseInt(getComputedStyle(active_trigger)['borderBottomWidth'], 10),
                  at_h          = parseInt(active_trigger.clientHeight, 10) + at_vert_boders,
                  y_pos         = parseInt(at_offset.y, 10) + parseInt(window.pageYOffset, 10) + at_h;
                    
            // left pos control - also checking side overflows
            let left = at_offset.left.toFixed(2);
            if(left < 0) {
                left = 0;
            }
            
            // top or bottom ? (actually only bottom - downsize the dd in case)  
            /*const y_pos_css = (y_pos - document.documentElement.scrollTop < window.innerHeight) ? 
                    'top:'+ y_pos : 
                    'transform: translate3d(0, calc((100% + '+ (active_trigger.offsetHeight - at_vert_boders) +'px) * -1), 0); top:'+ y_pos;*/
            const y_pos_css = 'top:'+ y_pos;

            dd.setAttribute('style', 'width:'+ dd_w +'px; '+ y_pos_css +'px; left: '+ left +'px;');          
        };
        
        
        
        /* append and populates dropdown with select options */
        this.append_dd = function() {
            const $this     = this,
                  select    = active_trigger.parentNode.querySelector('select');
            
            // var containing groups with options
            let structure = [
                /*
                group_name : {
                    opt_val : {
                        img     : (string) ,
                        name    : (string),
                        selected: (bool),
                        disabled: (bool)
                    }
                }
                */
            ],
            no_groups       = false,
            disabled_groups = []; 
            
            // retrieve groups
            if(!select.querySelectorAll('optgroup').length) {
                no_groups = true;
                structure['%%lcslt%%'] = {};
            }
            else {
                select.querySelectorAll('optgroup').forEach(group => {
                    structure[ group.getAttribute('label') ] = {};  
                    
                    if(group.disabled) {
                        disabled_groups.push( group.getAttribute('label') );    
                    }
                });
            }
            
            // retrieve options and associate them 
            select.querySelectorAll('option').forEach(opt => {
                
                let obj     = {
                    img     : (opt.hasAttribute('data-image')) ? opt.getAttribute('data-image').trim() : '',
                    name    : opt.innerHTML,
                    selected: opt.selected,
                    disabled: opt.disabled,
                };
                
                const group = (no_groups) ? '%%lcslt%%' : opt.parentNode.getAttribute('label');
                
                // skip options withoput a group, if there are groups
                if(!no_groups && !group) {
                    return;    
                }
                structure[ group ][ opt.getAttribute('value') ] = obj;
            });
            
            /////
            
            // prepare code
            const multiple_class = (active_trigger.classList.contains('lcslt-multiple')) ? 'lcslt-multiple-dd' : '';
            
            // additional classes
            const addit_classes = (typeof(options.addit_classes) == 'object') ? options.addit_classes.join(' ') : ''; 
            
            
            // build code
            let code = '<div id="lc-select-dd" class="'+ multiple_class +' '+ addit_classes +'">';
            
            // searchbar?
            const has_searchbar = (options.enable_search && select.querySelectorAll('option').length >= parseInt(options.min_for_search, 10)) ? true : false; 
            if(has_searchbar) {
                code += 
                '<ul><li class="lcslt-search-li">' +
                    '<input type="text" name="lcslt-search" value="" placeholder="'+ options.labels[0] +' .." autocomplete="off" />' +
                '</li></ul>';        
            }
            
            code += '<ul class="lc-select-dd-scroll">';
            
            
            // cycle
            Object.keys(structure).some((group) => {
                
                // open group
                if(!no_groups) {
                    const dis_class = (disabled_groups.indexOf(group) !== -1) ? 'lcslt-disabled': '';
                    
                    const optgroup = select.querySelector('optgroup[label="'+ group +'"]'),
                          img = (optgroup.hasAttribute('data-image') && optgroup.getAttribute('data-image')) ? '<i class="lcslt-img" style="background-image: url(\''+ optgroup.getAttribute('data-image').trim() +'\')"></i>' : '';
                    
                    code += 
                        '<li class="lcslt-group '+ dis_class +'"><span class="lcslt-group-name">'+ img + group +'</span>' +
                        '<ul class="lcslt-group-opts">';
                }
                
                // group options
                Object.keys( structure[group] ).some((opt) => { 
                    const vals      = structure[group][opt],
                          img       = (vals.img) ? '<i class="lcslt-img" style="background-image: url(\''+ vals.img +'\')"></i>' : '',
                          sel_class = (vals.selected) ? 'lcslt-selected': '',
                          dis_class = (vals.disabled || disabled_groups.indexOf(group) !== -1) ? 'lcslt-disabled': '';
                          
                    // hide simple dropdown placeholder opt
                    if(!multiple_class && select.querySelector('option[value="'+ opt +'"]').hasAttribute('data-lcslt-placeh')) {
                        return;        
                    }
                    
                    code += 
                        '<li class="lcslt-dd_opt '+ sel_class +' '+ dis_class +'" data-val="'+ opt +'">'+ 
                            '<span>'+ img + vals.name +'</span>'+
                        '</li>';
                });
                
                // close group
                if(!no_groups) {
                    code += '</ul></li>';           
                }         
            });
            document.body.insertAdjacentHTML('beforeend', code +'</ul></div>');
            
            
            // option selection listener
            document.querySelectorAll('.lcslt-dd_opt').forEach(opt => {
                opt.addEventListener("click", (e) => {$this.clicked_dd_option(e, opt)});        
            });

            
            // search listener
            if(has_searchbar) {
                
                // focus search field on open - on desktop 
                if(window.innerWidth > 1024) {
                    setTimeout(() => document.querySelector('input[name=lcslt-search]').focus(), 50);
                }
                
                document.querySelector('input[name=lcslt-search]').addEventListener("keyup", (e) => {
                    this.debounce('opts_search', 500, 'search_options'); 
                });
            }
        };
        
        
        
        /* actions on selection change */
        this.on_val_change = function(trigger) {
            const select = trigger.nextSibling,
                  values = Array.from( select.selectedOptions ).map(el=>el.value); 
            
            // trigger native "change" event
            const event = new Event('change');
            select.dispatchEvent(event);
            
            // callback?
            if(typeof(options.on_change) == 'function') {
                options.on_change.call(this, values, select);
            }
        };
        
        
        
        
        

        // HANDLERS
        
        // deselect option clicking on .lcslt-multi-selected
        this.deselect_option = function(e, trigger, opt) {
            trigger.nextSibling.querySelector('option[value="'+ opt.getAttribute('data-val') +'"]').selected = false;
            
            this.set_sel_content(trigger);
            this.on_val_change(trigger);
        };
        
        
        // dropdown option click (enable / disable / ignore)
        this.clicked_dd_option = function(e, opt) {
            const is_multiple   = active_trigger.classList.contains('lcslt-multiple'),
                  opt_val       = opt.getAttribute('data-val'),
                  select        = active_trigger.nextSibling;
            
            // ignore if disabled or not multiple and already selected or not selected and max opts reached
            if(
                opt.classList.contains('lcslt-disabled') || 
                (!is_multiple && opt.classList.contains('lcslt-selected')) ||
                (!opt.classList.contains('lcslt-selected') && active_trigger.classList.contains('lcslt-max-opts'))
            ) {
                return false;    
            }

            // if not multiple - unselect other options
            if(!is_multiple) {
                document.querySelectorAll('.lcslt-dd_opt').forEach(dd_opt => {
                    if( dd_opt.getAttribute('data-val') != opt_val ) {
                        dd_opt.classList.remove('lcslt-selected');    
                    }
                });
                select.querySelectorAll('option').forEach(select_opt => {
                    if( select_opt.getAttribute('value') != opt_val ) {
                        select_opt.selected = false;    
                    }
                });
            }
            
            // toggle selection
            opt.classList.toggle('lcslt-selected');
            select.querySelector('option[value="'+ opt_val +'"]').selected = !select.querySelector('option[value="'+ opt_val +'"]').selected;
            
            // sync with trigger
            this.set_sel_content();
            
            // spread events
            this.on_val_change(active_trigger);
            
            // be sure position is right
            if(is_multiple) {
                this.set_dd_position();
            }
            // simple dropdown - close it after choice
            else {
                active_trigger.click();
            }
        };

        
        // options search
        this.search_options = function() {
            const val           = document.querySelector('input[name=lcslt-search]').value.trim(),
                  groups        = document.querySelectorAll('.lcslt-group-name'),
                  opts          = document.querySelectorAll('.lcslt-dd_opt'),
                  no_results_li = document.querySelector('.lcslt-no-results');
            
            if(val.length < 2) {
                document.getElementById('lc-select-dd').classList.remove('lcslt-is-searching');
                
                groups.forEach(group => {
                    group.style.removeProperty('display');        
                });
                opts.forEach(opt => {
                    opt.style.removeProperty('display');        
                });
                
                if(no_results_li) {
                    no_results_li.remove();
                }
            }
            else {
                document.getElementById('lc-select-dd').classList.add('lcslt-is-searching');
                
                groups.forEach(group => {
                    group.style.display = 'none';        
                });
                
                // cycle
                const val_arr = val.split(' ');
                let no_results = true;
                
                opts.forEach(opt => {
                    let matching = false;
                    
                    val_arr.some((val_part) => {
                        if( opt.querySelector('span').innerHTML.toLowerCase().indexOf( val_part.toLowerCase() ) !== -1 ) {
                            matching = true;
                            no_results = false;
                        }
                    });
                    
                    (matching) ? opt.style.removeProperty('display') : opt.style.display = 'none';
                });
                
                
                // append "no results" element?
                if(no_results) {
                    if(!no_results_li) {
                        document.querySelector('.lc-select-dd-scroll').insertAdjacentHTML('beforeend', '<li class="lcslt-no-results"><span>'+ options.labels[3] +'</span></li>');        
                    }
                } else {
                    no_results_li.remove();    
                }
            }
        };
        
        
        
        
        
        
        /* 
         * UTILITY FUNCTION - debounce action to run once after X time 
         *
         * @param (string) action_name
         * @param (int) timing - milliseconds to debounce
         * @param (string) - class method name to call after debouncing
         * @param (mixed) - extra parameters to pass to callback function
         */
        this.debounce = function(action_name, timing, cb_function, cb_params) {
            if( typeof(debounced_vars[ action_name ]) != 'undefined' && debounced_vars[ action_name ]) {
                clearTimeout(debounced_vars[ action_name ]);    
            }
            const $this = this;
            
            debounced_vars[ action_name ] = setTimeout(() => {
                $this[cb_function].call($this, cb_params);    
            }, timing); 
        };
        
        
        
        
        
        /* CSS - creates inline CSS into the page */
        this.generate_style = function() {       
            const magnifier_svg = "    url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iNTg3LjQ3MXB4IiBoZWlnaHQ9IjU4Ny40NzFweCIgdmlld0JveD0iMCAwIDU4Ny40NzEgNTg3LjQ3MSIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNTg3LjQ3MSA1ODcuNDcxOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PGc+PGc+PHBhdGggZD0iTTIyMC4zMDIsNDQwLjYwNGMxMjEuNDc2LDAsMjIwLjMwMi05OC44MjYsMjIwLjMwMi0yMjAuMzAyQzQ0MC42MDQsOTguODI2LDM0MS43NzcsMCwyMjAuMzAyLDBDOTguODI2LDAsMCw5OC44MjYsMCwyMjAuMzAyQzAsMzQxLjc3Nyw5OC44MjYsNDQwLjYwNCwyMjAuMzAyLDQ0MC42MDR6IE0yMjAuMzAyLDcxLjE0MmM4Mi4yNDcsMCwxNDkuMTU5LDY2LjkxMywxNDkuMTU5LDE0OS4xNTljMCw4Mi4yNDgtNjYuOTEyLDE0OS4xNi0xNDkuMTU5LDE0OS4xNnMtMTQ5LjE2LTY2LjkxMi0xNDkuMTYtMTQ5LjE2QzcxLjE0MiwxMzguMDU1LDEzOC4wNTUsNzEuMTQyLDIyMC4zMDIsNzEuMTQyeiIvPjxwYXRoIGQ9Ik01MjUuNTIzLDU4Ny40NzFjMTYuNTU1LDAsMzIuMTEzLTYuNDQ3LDQzLjgwMS0xOC4xNThjMTEuNjk5LTExLjY4LDE4LjE0Ni0yNy4yMzQsMTguMTQ2LTQzLjc5MWMwLTE2LjU1My02LjQ0Ny0zMi4xMTUtMTguMTUyLTQzLjgyMkw0NDYuNjQzLDM1OS4wMjNjLTMuMjYyLTMuMjYyLTcuNDc1LTUuMDYxLTExLjg1OS01LjA2MWMtNS40NDksMC0xMC40NjUsMi43MTEtMTMuNzYyLDcuNDM4Yy0xNi4yMzgsMjMuMzE4LTM2LjI5Nyw0My4zNzctNTkuNjEzLDU5LjYxNWMtNC4yNTgsMi45NjUtNi45NDcsNy40NjctNy4zNzksMTIuMzUyYy0wLjQyOCw0LjgyOCwxLjM5Myw5LjY2Niw0Ljk5OCwxMy4yN2wxMjIuNjc0LDEyMi42NzZDNDkzLjQwNiw1ODEuMDIzLDUwOC45NjksNTg3LjQ3MSw1MjUuNTIzLDU4Ny40NzF6Ii8+PC9nPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48Zz48L2c+PGc+PC9nPjxnPjwvZz48L3N2Zz4=')";
            
            document.head.insertAdjacentHTML('beforeend', 
`<style>
.lcslt-wrap {
    position: relative;
    display: inline-block;
}
.lcslt-wrap select {
    display: none !important;
}
.lcslt {
    display: flex;
	align-items: center;
	flex-direction: row;
	flex-wrap: wrap;
    width: 100%;
    min-height: 15px;
    padding: 5px 30px 5px 5px;
    position: relative;
    overflow: hidden;  
    font-size: 1rem;
}
.lcslt:not(.lcslt-disabled):not(.lcslt-max-opts) {
    cursor: pointer;
}
.lcslt:not(.lcslt-multiple):after {
	content: "";
	width: 0;
	height: 0;
	border-left: 5px solid transparent;
	border-right: 5px solid transparent;
	border-top: 6px solid #444;
	display: inline-block;
    position: absolute;
    right: 6px;
    transition: transform .3s ease; 
}
.lcslt.lcslt_dd-open:after {
    transform: rotate(180deg);
}
.lcslt:not(.lcslt-multiple) > span {
    line-height: normal;
}
.lcslt span,
.lcslt-multi-selected {
    max-width: 100%;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.lcslt-multiple {
	padding: 5px 5px 0 5px;
	height: auto;
	line-height: 0;
}
.lcslt-opt {
    display: inline-block;
    margin: 0 0 5px 5px; 
}
.lcslt-multi-selected {
	display: flex;
	position: relative;
	line-height: normal;
	align-items: center;
}
.lcslt:not(.lcslt-disabled) .lcslt-multi-selected {
    cursor: pointer;
}
.lcslt-multi-selected:before {
    content: "×";
    font-family: arial;
}
.lcslt-multi-callout {
	display: inline-block;
    line-height: 0;
}
.lcslt-placeholder {
	line-height: normal;
	padding-bottom: 5px;
}


.lcslt-wrap,
.lcslt-wrap *,
#lc-select-dd,
#lc-select-dd * {
    box-sizing: border-box;
}
#lc-select-dd {
	visibility: hidden;
	z-index: -100;
	position: absolute;
	top: -9999px;
	z-index: 999;
	overflow: hidden;
	border-top: none;
	font-size: 1rem;
	font-family: sans-serif;
}
#lc-select-dd.lcslt-shown {
    visibility: visible;
    z-index: 99999999;
}
.lc-select-dd-scroll {
    max-height: 200px; 
    overflow: auto;
}
.lcslt-search-li { 
    padding: 0 !important;
    margin: 0 !important;
    position: relative;
}
.lcslt-search-li input {
    width: 100%;
    padding-right: 36px;
    line-height: normal;
}
.lcslt-search-li input[type=text] { /* for iOS safari */
    border: none;
    outline: none;
    -webkit-appearance: none;
    -webkit-border-radius: 0;
}
.lcslt-search-li input[type=text],
.lcslt-search-li input[type=text]:hover,
.lcslt-search-li input[type=text]:active,
.lcslt-search-li input[type=text]:focus,
.lcslt-search-li input[type=text]:focus-visible {
    border: none;
    outline: none;
}
.lcslt-search-li:before {
    content: "";
    position: absolute;
    z-index: 10;
    width: 25px;
    height: 50%;
    right: 8px;
    top: 50%;
    -webkit-mask: ${ magnifier_svg } no-repeat right center;
    mask: ${ magnifier_svg } no-repeat right center;
    -webkit-mask-size: contain;
    mask-size: contain;
    transform: translate3d(0, -53%, 0);
}
#lc-select-dd li {
    width: 100%;
}
#lc-select-dd li > div {
    display: flex;
    align-items: center;
}
#lc-select-dd li span {
    word-break: break-all;
}
#lc-select-dd li span,
#lc-select-dd li img {
    display: inline-block;
    line-height: normal;
    vertical-align: bottom;
}
.lcslt-dd_opt:not(.lcslt-disabled):not(.lcslt-selected),
.lcslt-multiple-dd .lcslt-dd_opt:not(.lcslt-disabled) {   
    cursor: pointer;
}
.lcslt-img {
    background-position: center center;
    background-repeat: no-repeat;
    background-size: contain;
    background-color: transparent;
    vertical-align: bottom;
    line-height: 0;
    font-size: 0;
}
</style>`);
        };
        

        // init when called
        this.init();
    };
    
    
    
    
    ////////////////////////////////////////////////////////////
    
    
    
    
    // UTILITIES
    
    // sanitize "selector" parameter allowing both strings and DOM objects
    const maybe_querySelectorAll = (selector) => {
             
        if(typeof(selector) != 'string') {
            return (selector instanceof Element) ? [selector] : Object.values(selector);   
        }
        return document.querySelectorAll(selector);
    };
    
    
    // pure-JS equivalent to parents()
    const recursive_parent = (element, target) => {
        let node = element;
        
        while(node.parentNode != null && !node.matches(target) ) {
            node = node.parentNode;
        }
        return node;
    };
    
    
})();