<?php
/**
 * JetFormBuilder Integration for Persian Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', 'persca_jet_form_builder_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_form_builder_enqueue_assets', 20);

// Modify dependencies to ensure integrate-jet-form-builder.js loads AFTER JetFormBuilder's frontend script
add_action('wp_default_scripts', 'persca_jet_form_builder_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_form_builder_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_form_builder_add_dependencies', 100);

function persca_jet_form_builder_enqueue_assets() {
    if (!function_exists('jet_form_builder')) {
        return;
    }

    // Enqueue base Persian calendar script and converter
    wp_enqueue_script(
        'persian-calendar-main',
        PERSCA_PLUGIN_URL . 'assets/js/persian-calendar.js',
        array('jquery'),
        PERSCA_PLUGIN_VERSION,
        true
    );

    // Enqueue main Gutenberg calendar styles for the custom datepicker
    wp_enqueue_style(
        'persian-calendar-gutenberg-styles',
        PERSCA_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue Jet integration overrides styles (shared between JetEngine and JetFormBuilder)
    wp_enqueue_style(
        'persca-integrate-jet-styles',
        PERSCA_PLUGIN_URL . 'assets/css/integrate-jet.css',
        array('persian-calendar-gutenberg-styles'),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue JetFormBuilder integration overrides script
    wp_enqueue_script(
        'persca-integrate-jet-form-builder',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-form-builder.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

function persca_jet_form_builder_add_dependencies() {
    global $wp_scripts;
    if (!$wp_scripts) {
        return;
    }
    
    $target_scripts = array(
        'jet-form-builder-frontend-forms',
        'jfb-records',
        'jfb-records-single',
        'jfb-payments',
        'jfb-payment',
    );
    
    foreach ($target_scripts as $handle) {
        if (isset($wp_scripts->registered[$handle])) {
            $deps = $wp_scripts->registered[$handle]->deps;
            if (!in_array('persca-integrate-jet-form-builder', $deps, true)) {
                $wp_scripts->registered[$handle]->deps[] = 'persca-integrate-jet-form-builder';
            }
        }
    }
}
