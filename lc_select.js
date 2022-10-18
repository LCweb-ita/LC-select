/**
 * lc_select.js - Superlight Javascript dropdowns
 * Version: 1.1.7
 * Author: Luca Montanari (LCweb)
 * Website: https://lcweb.it
 * Licensed under the MIT license
 */


(function() { 
	"use strict";
    if(typeof(window.lc_select) != 'undefined') {return false;} // prevent multiple script inits  
    
    
    /*** vars ***/
    let debounced_vars  = [],
        noscroll_window = false,
        
        style_generated = null,
        active_trigger  = null;
    
    
    
    /*** default options ***/
    const def_opts = {
        enable_search   : true, // (bool) whether to enable fields search
        min_for_search  : 7, // (int) minimum options number to show search  
        autofocus_search: false, // (bool) whether to automatically focus search field on desktop (NB: will break tabindex chain)
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
    
    

    // disable page scroll on element scroll
    window.addEventListener('scroll', (e) => {
        if(document.querySelector('.lc-select-dd-scroll') && noscroll_window) {
            window.scrollTo(noscroll_window[0], noscroll_window[1]);
        }
    });
    
    
    
    /* navigate through dd opts with keys (38 up, 40 down, 13 enter, 27 exit, 9 tab)*/
    document.addEventListener("keydown", (e) => {
        if([38, 40, 13, 27, 9].indexOf(e.keyCode) === -1 || !document.querySelector("#lc-select-dd.lcslt-shown")) {
            return true;    
        }
        
        e.preventDefault();
        const highlighted   = document.querySelector(".lcslt-dd-opt.lcslt-dd-opt-hlight"),
              opts          = document.querySelectorAll(".lcslt-dd-opt:not(.lcslt-disabled)"),
              event         = new Event('mouseenter', {bubbles:true});

        switch(e.keyCode) {
            case 27 : // close
                active_trigger.click();
                break;
                
            case 9 : // tab
                if(!document.activeElement.classList || !document.activeElement.classList.contains('lcslt-tabindex-trick')) {
                    active_trigger.click();    
                }
                break;
            
            case 13 : // select
                if(highlighted) {
                    highlighted.classList.remove('lcslt-dd-opt-hlight');
                    highlighted.click();
                }
                break;
            
            case 38 : // up
            case 40 : // down
                let sel_index = (e.keyCode == 38) ? 0 : opts.length - 1; // by default set to first or last element

                if(highlighted) {
                    opts.forEach((opt, i) => {
                        if(opt == highlighted) {
                            sel_index = i;    
                        }
                    });  
                }
                
                let new_sel;
                if(e.keyCode == 38) {
                    new_sel = (!sel_index) ? opts.length - 1 : sel_index - 1;    
                } else {
                    new_sel = (sel_index == (opts.length - 1)) ? 0 : sel_index + 1;
                }
                
                opts[new_sel].dispatchEvent(event);
                set_hlight_opt_scroll();
                break;
        }
        
        return true;
    });
    
    
    
    /* set dropdown scroll position for highlighted option */
    const set_hlight_opt_scroll = () => {
        const hlight = document.querySelector('.lcslt-dd-opt-hlight');
        if(!hlight) {
            return false;    
        }
        
        const top_border = parseInt(getComputedStyle(hlight)['borderTopWidth'], 10);
        document.querySelector(".lc-select-dd-scroll").scrollTop = hlight.offsetTop - ((hlight.offsetHeight + top_border) * 2) - 10; 
    };
    

    
    
    
    /*** plugin class ***/
    window.lc_select = function(attachTo, options = {}) {
        if(!attachTo) {
            return console.error('You must provide a valid selector or DOM object as first argument');
        }
    
        // override options
        if(typeof(options) != 'object') {
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
                if(el.parentNode.classList.length && el.parentNode.classList.contains('lcslt-wrap')) {
                    return;    
                }

                $this.wrap_element(el);

                
                // hook to update LC select implementation of select fields (eg. when new fields are dynamically added)
                el.removeEventListener('lc-select-refresh', () => {});
                el.addEventListener('lc-select-refresh', (e) => {
                    
                    // close eventually opened dropdowns
                    if(active_trigger) {
                        active_trigger.click();    
                    }
                    
                    const trigger = e.target.parentNode.querySelector('.lcslt');
                    $this.set_sel_content(trigger);
                    
                    // only on initialized elements
                    if(!e.target.parentNode.classList.length || (e.target.parentNode.classList.length && !e.target.parentNode.classList.contains('lcslt-wrap'))) {
                        return false;    
                    }
                    
                    // track disabled status
                    (e.target.disabled) ? trigger.classList.add('lcslt-disabled') : trigger.classList.remove('lcslt-disabled'); 
                    
                    return true;
                });
                
                
                // hook destroying LC select implementation of select fields
                el.removeEventListener('lc-select-destroy', () => {});
                el.addEventListener('lc-select-destroy', (e) => {
                    
                    // close eventually opened dropdowns
                    if(active_trigger) {
                        active_trigger.click();    
                    }
                    
                    const select    = e.target,
                          wrap      = e.target.parentNode,
                          fake_opt  = select.querySelector('option[data-lcslt-placeh="1"]');

                    // only on initialized elements
                    if(!wrap.classList.length || (wrap.classList.length && !wrap.classList.contains('lcslt-wrap'))) {
                        return false;    
                    }
                    
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
                  multi_class   = (el.multiple) ? 'lcslt-multiple' : '',
                  tabindex      = (el.getAttribute('tabindex')) ? parseInt(el.getAttribute('tabindex'), 10) : '';
            
            // be sure there's a placeholder for multiple
            let placeh = (el.hasAttribute('data-placeholder')) ? el.getAttribute('data-placeholder').trim() : ''; 
            if(!placeh && multi_class) {
                placeh = options.labels[2];    
            }
            
            // escape placeholder value for safe usage in attributes
            placeh = placeh
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');  
            
            
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
            
            
            div.classList.add("lcslt-wrap", fname_class);
            div.innerHTML = '<input type="text" name="'+ fname_class +'-tit" tabindex="'+ tabindex +'" class="lcslt-tabindex-trick" />' +
                            '<div class="lcslt '+ fname_class +' '+ multi_class +' '+ disabled_class +'" data-placeh="'+ placeh +'"></div>';

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
            
            // tabindex focus trick
            div.querySelector('.lcslt-tabindex-trick').onfocus = (e) => {
                trigger.click();
            };
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
            
            select.querySelectorAll('option').forEach(opt => {
                
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
                
                if(active_trigger) {
                    active_trigger.classList.remove('lcslt_dd-open');
                }
            }
            
            // close if already opened
            if(trigger == active_trigger) {
                active_trigger = null;
                return false;
            }
            active_trigger = trigger;
            
            this.append_dd();
            this.set_dd_position();
            set_hlight_opt_scroll();
            
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
                  at_h          = parseInt(active_trigger.clientHeight, 10) + parseInt(getComputedStyle(active_trigger)['borderTopWidth'], 10),
                  y_pos         = parseInt(at_offset.y, 10) + parseInt(window.pageYOffset, 10) + at_h;
                    
            // left pos control - also checking side overflows
            let left = at_offset.left.toFixed(2);
            if(left < 0) {
                left = 0;
            }

            dd.setAttribute('style', 'width:'+ dd_w +'px; top:'+ y_pos +'px; left: '+ left +'px;');          
        };
        
        
        
        /* append and populates dropdown with select options */
        this.append_dd = function() {
            const $this         = this,
                  select        = active_trigger.parentNode.querySelector('select'),
                  highligh_set  = false;
            
            // var containing groups with options
            let structure = new Map(),
                /*
                group_name : [map] {
                    opt_val : {
                        img     : (string) ,
                        name    : (string),
                        selected: (bool),
                        disabled: (bool)
                    }
                }
                */
            no_groups       = false,
            disabled_groups = []; 
            
            // retrieve groups
            if(!select.querySelectorAll('optgroup').length) {
                no_groups = true;
                structure.set('%%lcslt%%', new Map());
            }
            else {
                select.querySelectorAll('optgroup').forEach(group => {
                    structure.set(group.getAttribute('label'), new Map());
                    
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
                
                structure.get( group ).set( opt.getAttribute('value'), obj );
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
                    '<input type="text" name="lcslt-search" value="" placeholder="'+ options.labels[0] +'" autocomplete="off" />' +
                '</li></ul>';        
            }
            
            code += '<ul class="lc-select-dd-scroll">';
            
            
            // cycle
            structure.forEach((group, group_key) => {
                
                // open group
                if(!no_groups) {
                    const dis_class = (disabled_groups.indexOf(group) !== -1) ? 'lcslt-disabled': '';
                    
                    const optgroup = select.querySelector('optgroup[label="'+ group_key +'"]'),
                          img = (optgroup.hasAttribute('data-image') && optgroup.getAttribute('data-image')) ? '<i class="lcslt-img" style="background-image: url(\''+ optgroup.getAttribute('data-image').trim() +'\')"></i>' : '';
                    
                    code += 
                        '<li class="lcslt-group '+ dis_class +'"><span class="lcslt-group-name">'+ img + group_key +'</span>' +
                        '<ul class="lcslt-group-opts">';
                }
                
                // group options
                structure.get(group_key).forEach((opt, opt_key) => {
                    const vals          = structure.get(group_key).get(opt_key),
                          img           = (vals.img) ? '<i class="lcslt-img" style="background-image: url(\''+ vals.img +'\')"></i>' : '',
                          sel_class     = (vals.selected) ? 'lcslt-selected' : '',
                          dis_class     = (vals.disabled || disabled_groups.indexOf(group) !== -1) ? 'lcslt-disabled': '',
                          hlight_class  = (!highligh_set && sel_class) ? 'lcslt-dd-opt-hlight' : '';
                    
                    // hide simple dropdown placeholder opt
                    if(!multiple_class && select.querySelector('option[value="'+ opt_key +'"]').hasAttribute('data-lcslt-placeh')) {
                        return;        
                    }

                    code += 
                        '<li class="lcslt-dd-opt '+ sel_class +' '+ dis_class +' '+ hlight_class +'" data-val="'+ opt_key +'">'+ 
                            '<span>'+ img + vals.name +'</span>'+
                        '</li>';
                });
                
                // close group
                if(!no_groups) {
                    code += '</ul></li>';           
                }         
            });
            document.body.insertAdjacentHTML('beforeend', code +'</ul></div>');
            
            
            document.querySelectorAll('.lcslt-dd-opt').forEach(opt => {
                
                // option selection listener
                opt.addEventListener("click", (e) => {
                    $this.clicked_dd_option(e, opt);
                });   
                
                // option highlighter listener
                opt.addEventListener("mouseenter", (e) => {
                    if(document.querySelector('.lcslt-dd-opt-hlight')) {
                        document.querySelector('.lcslt-dd-opt-hlight').classList.remove('lcslt-dd-opt-hlight');        
                    }
                    if(!opt.classList.contains('lcslt-disabled')) {
                        opt.classList.add('lcslt-dd-opt-hlight');
                    }
                });
                opt.addEventListener("mouseleave", (e) => {
                    opt.classList.remove('lcslt-dd-opt-hlight');
                }); 
            });


            
            // search listener
            if(has_searchbar) {
                
                // focus search field on open - on desktop 
                if(window.innerWidth > 1024 && options.autofocus_search) {
                    setTimeout(() => document.querySelector('input[name=lcslt-search]').focus(), 50);
                }
                
                document.querySelector('input[name=lcslt-search]').addEventListener("keyup", (e) => {
                    this.debounce('opts_search', 500, 'search_options'); 
                });
            }
            
            
            
            // disable page scroll on element scroll
            document.querySelector('.lc-select-dd-scroll').addEventListener('mouseenter', () => {
                noscroll_window = [window.pageXOffset, window.pageYOffset];
            });
            document.querySelector('.lc-select-dd-scroll').addEventListener('mouseleave', () => {
                noscroll_window = false;
            });
        };
        
        
        
        /* actions on selection change */
        this.on_val_change = function(trigger) {
            const select = trigger.nextSibling,
                  values = Array.from( select.selectedOptions ).map(el=>el.value); 
            
            // trigger native "change" event
            const event = new Event('change', {bubbles:true});
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
                document.querySelectorAll('.lcslt-dd-opt').forEach(dd_opt => {
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
            opt.classList.remove('lcslt-dd-opt-hlight');
            
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
            if(!document.querySelector('input[name=lcslt-search]')) {
                return false;    
            }
            
            const val           = document.querySelector('input[name=lcslt-search]').value.trim(),
                  groups        = document.querySelectorAll('.lcslt-group-name'),
                  opts          = document.querySelectorAll('.lcslt-dd-opt'),
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
                    if(no_results_li) {
                        no_results_li.remove();
                    }
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
.lcslt span:not(.lcslt-placeholder):not(.lcslt-multi-callout) {
	line-height: 1.1em;
	font-size: 0.95em;
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
.lcslt-tabindex-trick {
    position: fixed;
    top: -99999px;
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
#lc-select-dd ul {
	margin: 0;
    padding: 0;
	list-style: none;
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
    margin: 0;
}
#lc-select-dd li > div {
    display: flex;
    align-items: center;
}
#lc-select-dd li span {
    word-break: break-all;
}
#lc-select-dd li span {
    display: inline-block;
    line-height: normal;
}
.lcslt-dd-opt:not(.lcslt-disabled):not(.lcslt-selected),
.lcslt-multiple-dd .lcslt-dd-opt:not(.lcslt-disabled) {   
    cursor: pointer;
}
.lcslt-img {
    background-position: center center;
    background-repeat: no-repeat;
    background-size: contain;
    background-color: transparent;
    vertical-align: top;
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
            if(selector instanceof Element) { // JS or jQuery 
                return [selector];
            }
            else {
                let to_return = [];
                
                for(const obj of selector) {
                    if(obj instanceof Element) {
                        to_return.push(obj);    
                    }
                }
                return to_return;
            }
        }
        
        // clean problematic selectors
        (selector.match(/(#[0-9][^\s:,]*)/g) || []).forEach(function(n) {
            selector = selector.replace(n, '[id="' + n.replace("#", "") + '"]');
        });
        
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