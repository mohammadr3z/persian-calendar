<?php
/**
 * Admin interface functionality for Persian Calendar plugin.
 *
 * Handles the WordPress admin dashboard integration, settings page,
 * and administrative functionality for the Persian Calendar plugin.
 *
 * @package PERSCA
 * @since 1.0.0
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Admin interface class for Persian Calendar plugin.
 *
 * Manages the WordPress admin dashboard integration including
 * settings page registration, field rendering, and option handling.
 *
 * @since 1.0.0
 */
final class PERSCA_Admin {
    /**
     * Plugin options key.
     *
     * @var string
     */
    const OPTIONS_KEY = 'persca_options';

    /**
     * Plugin instance.
     *
     * @var PERSCA_Plugin|null
     */
    private $plugin;

    /**
     * Constructor.
     *
     * @param PERSCA_Plugin|null $plugin Plugin instance.
     */
    public function __construct( $plugin = null ) {
        $this->plugin = $plugin;
    }

    /**
     * Initialize admin functionality.
     *
     * @since 1.0.0
     */
    public function init() : void {
        add_action( 'admin_menu', [ $this, 'add_settings_page' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_styles' ] );
    }

    /**
     * Enqueue admin styles.
     *
     * @since 1.0.0
     */
    public function enqueue_admin_styles( $hook ) : void {
        if ( 'settings_page_persian-calendar' !== $hook ) {
            return;
        }
        wp_enqueue_style( 'dashicons' );
        wp_enqueue_style(
            'persian-calendar-admin',
            PERSCA_PLUGIN_URL . 'assets/css/admin.css',
            ['dashicons'],
            PERSCA_PLUGIN_VERSION
        );
    }

    /**
     * Add the options page.
     *
     * @since 1.0.0
     */
    public function add_settings_page() : void {
        add_options_page(
            __( 'Persian Calendar Settings', 'persian-calendar' ),
			__( 'Persian Calendar', 'persian-calendar' ),
            'manage_options',
            'persian-calendar',
            [ $this, 'render_settings_page' ]
        );
    }

    /**
     * Register the setting, section and fields.
     *
     * @since 1.0.0
     */
    public function register_settings() : void {
        register_setting( 'persca_settings', self::OPTIONS_KEY, [ $this, 'sanitize_options' ] );

        add_settings_section(
            'persca_main',
            __( 'General Settings', 'persian-calendar' ),
            function() {
                echo '<p>' . esc_html__( 'Configure Persian calendar conversion and Persian digit settings.', 'persian-calendar' ) . '</p>';
            },
            'persian-calendar'
        );

        // Settings fields are rendered manually in render_settings_fields() method


    }

    /**
     * Sanitize options before saving.
     *
     * @since 1.0.0
     *
     * @param array $input Raw input array.
     * @return array       Cleaned options array.
     */
    public function sanitize_options( $input ) : array {
        $defaults = $this->get_default_options();
        
        // Check user permissions
        if ( ! current_user_can( 'manage_options' ) ) {
            add_settings_error(
                self::OPTIONS_KEY,
                'permission_denied',
                __( 'You do not have permission to change these settings.', 'persian-calendar' ),
                'error'
            );
            return $defaults;
        }
        
        // Validate input is array
        if ( ! is_array( $input ) ) {
            return $defaults;
        }
        
        // Verify nonce for security
        if ( ! isset( $_POST['persca_nonce'] ) ||
            ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['persca_nonce'] ) ), 'persca_settings' ) ) {
            add_settings_error(
                self::OPTIONS_KEY,
                'nonce_failed',
                __( 'Security error: Invalid request.', 'persian-calendar' ),
                'error'
            );
            return $defaults;
        }
        
        $out = [];
        foreach ( $defaults as $key => $def ) {
            // Sanitize and validate each option
            $value = isset( $input[$key] ) ? sanitize_key( $input[$key] ) : '';
            $out[$key] = ! empty( $value ) ? (bool) $value : false;
        }
        
        return wp_parse_args( $out, $defaults );
    }

    /**
     * Get default options.
     *
     * @return array
     */
    private function get_default_options() : array {
        return self::get_default_settings();
    }

    /**
     * Get default settings array (static method for external access).
     *
     * @return array
     */
    public static function get_default_settings() : array {
        return [
            'enable_jalali'        => true,
            'enable_persian_digits' => false,
            'regional_settings'    => true,
            'enable_dashboard_font' => true,
            'enable_gutenberg_calendar' => true,

        ];
    }

    /**
     * Check if an option is enabled.
     *
     * @param array $options Options array.
     * @param string $key Option key to check.
     * @return bool True if option is enabled, false otherwise.
     */
    private function is_option_enabled( array $options, string $key ) : bool {
        return ! empty( $options[$key] );
    }

    /**
     * Render a checkbox field with toggle switch.
     *
     * @since 1.0.0
     *
     * @param array $args Field args: option key and description.
     */
    public function checkbox_field( array $args ) : void {
        // Check user permissions before rendering admin fields
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        
        $opts = get_option( self::OPTIONS_KEY, $this->get_default_options() );
        $key  = $args['option'];
        $icon = isset( $args['icon'] ) ? '<span class="dashicons ' . esc_attr( $args['icon'] ) . '"></span>' : '<span class="dashicons dashicons-admin-generic"></span>';
        $label = isset( $args['label'] ) ? $args['label'] : '';
        
        echo '<div class="persian-calendar-settings-row">';
        echo '<div class="persian-calendar-settings-icon">' . wp_kses_post( $icon ) . '</div>';
        echo '<div class="persian-calendar-settings-content">';
        echo '<div class="persian-calendar-settings-title">' . esc_html( $label ) . '</div>';
        echo '<p class="persian-calendar-settings-description">' . esc_html( $args['desc'] ) . '</p>';
        echo '</div>';
        echo '<div class="persian-calendar-settings-control">';
        echo '<label class="persian-calendar-toggle">';
        printf(
            '<input type="checkbox" id="%1$s" name="' . esc_attr( self::OPTIONS_KEY ) . '[%1$s]" value="1" %2$s/>',
            esc_attr( $key ),
            checked( $this->is_option_enabled( $opts, $key ), true, false )
        );
        echo '<span class="persian-calendar-slider"></span>';
        echo '</label>';
        echo '</div>';
        echo '</div>';
    }



    /**
     * Render settings fields manually.
     *
     * @since 1.0.0
     */
    private function render_settings_fields() : void {
        $fields = [
            'enable_jalali' => [
                'label' => __( 'Jalali Calendar', 'persian-calendar' ),
                'desc' => __( 'Enable Persian/Jalali calendar system for the entire website.', 'persian-calendar' ),
                'icon' => 'dashicons-calendar-alt',
            ],
            'enable_gutenberg_calendar' => [
                'label' => __( 'Gutenberg Calendar', 'persian-calendar' ),
                'desc' => __( 'Enable Persian calendar in Gutenberg editor.', 'persian-calendar' ),
                'icon' => 'dashicons-edit',
            ],
            'regional_settings' => [
                'label' => __( 'Regional Settings', 'persian-calendar' ),
                'desc' => __( 'Set website timezone to Iran and start week from Saturday.', 'persian-calendar' ),
                'icon' => 'dashicons-admin-site-alt3',
            ],
            'enable_persian_digits' => [
                'label' => __( 'Persian Digits', 'persian-calendar' ),
                'desc' => __( 'Convert English digits to Persian digits in dates.', 'persian-calendar' ),
                'icon' => 'dashicons-editor-ol',
            ],
            'enable_dashboard_font' => [
                'label' => __( 'Dashboard Font', 'persian-calendar' ),
                'desc' => __( 'Apply clear and beautiful Persian font for WordPress dashboard.', 'persian-calendar' ),
                'icon' => 'dashicons-editor-textcolor',
            ],
        ];

        foreach ( $fields as $option => $field_data ) {
            $field_args = [
                'label_for' => $option,
                'option'    => $option,
                'label'     => $field_data['label'],
                'desc'      => $field_data['desc'],
                'icon'      => $field_data['icon'],
            ];
            $this->checkbox_field( $field_args );
        }
    }

    /**
     * Render the settings page.
     *
     * @since 1.0.0
     */
    public function render_settings_page() : void {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        ?>
        <div class="persian-calendar-settings">
            <!-- Header -->
            <div class="persian-calendar-header">
                <div class="persian-calendar-header-main">
                    <div class="persian-calendar-header-title">
                        <h4><?php esc_html_e( 'Persian Calendar Settings', 'persian-calendar' ); ?></h4>
                <p><?php esc_html_e( 'Configure Persian calendar and digit conversion settings for your WordPress site', 'persian-calendar' ); ?></p>
                    </div>
                </div>
                <div class="persian-calendar-logo">
                    <img src="<?php echo esc_url(PERSCA_PLUGIN_URL . 'assets/images/icon.png'); ?>" alt="Persian Calendar Logo">
                </div>
            </div>

            <!-- Main Content -->
            <div class="persian-calendar-main">
                <!-- Content -->
                <div class="persian-calendar-content">
                    <div class="persian-calendar-card">
                        <div class="persian-calendar-card-header">
                            <h4><?php esc_html_e( 'General Settings', 'persian-calendar' ); ?></h4>
                        </div>
                        <div class="persian-calendar-card-body">
                            <form id="persian-calendar-form" method="post" action="options.php">
                                <?php
                                settings_fields( 'persca_settings' );
                        wp_nonce_field( 'persca_settings', 'persca_nonce' );
                                $this->render_settings_fields();
                                ?>
                            </form>
                        </div>
                    </div>
                    <button type="submit" form="persian-calendar-form" class="persian-calendar-submit">
                        <?php esc_html_e( 'Save Changes', 'persian-calendar' ); ?>
                    </button>
                </div>

                <!-- Sidebar -->
                <div class="persian-calendar-sidebar">
                    <!-- About Plugin -->
                    <div class="persian-calendar-about">
                        <div class="persian-calendar-about-header">
                        </div>
                        <p><?php esc_html_e( 'Persian Calendar plugin converts Gregorian dates to Persian/Jalali dates in WordPress.', 'persian-calendar' ); ?></p>
                    <p><?php esc_html_e( 'Perfect for Persian websites', 'persian-calendar' ); ?></p>
                    </div>

                    <!-- Premium Ad -->
                    <div class="persian-calendar-premium-ad">
                        <div class="premium-ad-content">
                            <h5><?php esc_html_e( 'Need More Features?', 'persian-calendar' ); ?></h5>
                        <p><?php esc_html_e( 'Access advanced Persian calendar features and premium support.', 'persian-calendar' ); ?></p>
                        <a href="<?php echo esc_url( '#' ); ?>" class="premium-ad-button"><?php esc_html_e( 'Learn More', 'persian-calendar' ); ?></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}