<?php
/**
 * Admin interface functionality for Persian Calendar plugin.
 *
 * Handles the WordPress admin dashboard integration, settings page,
 * and administrative functionality for the Persian Calendar plugin.
 *
 * @package Persian_Calendar
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
final class PC_Admin {
    /**
     * Plugin options key.
     *
     * @var string
     */
    const OPTIONS_KEY = 'persian_calendar_options';

    /**
     * Plugin instance.
     *
     * @var PC_Plugin|null
     */
    private $plugin;

    /**
     * Constructor.
     *
     * @param PC_Plugin|null $plugin Plugin instance.
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
            PC_PLUGIN_URL . 'assets/css/admin.css',
            ['dashicons'],
            PC_PLUGIN_VERSION
        );
    }

    /**
     * Add the options page.
     *
     * @since 1.0.0
     */
    public function add_settings_page() : void {
        add_options_page(
            __( 'تنظیمات تقویم فارسی', 'persian-calendar' ),
            __( 'تقویم فارسی', 'persian-calendar' ),
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
        register_setting( 'persian_calendar', self::OPTIONS_KEY, [ $this, 'sanitize_options' ] );

        add_settings_section(
            'persian_calendar_main',
            __( 'تنظیمات عمومی', 'persian-calendar' ),
            function() {
                echo '<p>' . esc_html__( 'پیکربندی تبدیل تقویم شمسی و اعداد فارسی.', 'persian-calendar' ) . '</p>';
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
                __( 'شما مجوز تغییر این تنظیمات را ندارید.', 'persian-calendar' ),
                'error'
            );
            return $defaults;
        }
        
        // Validate input is array
        if ( ! is_array( $input ) ) {
            return $defaults;
        }
        
        // Verify nonce for security
        if ( ! isset( $_POST['persian_calendar_nonce'] ) || 
             ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['persian_calendar_nonce'] ) ), 'persian_calendar_settings' ) ) {
            add_settings_error(
                self::OPTIONS_KEY,
                'nonce_failed',
                __( 'خطای امنیتی: درخواست نامعتبر است.', 'persian-calendar' ),
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
            'permalink_jalali_date' => false,
            'enable_edd_compatibility' => false,
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
                'label' => __( 'تاریخ شمسی', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه سیستم تاریخ شمسی برای کل وب‌سایت فعال خواهد شد.', 'persian-calendar' ),
                'icon' => 'dashicons-calendar-alt',
            ],
            'enable_gutenberg_calendar' => [
                'label' => __( 'تقویم گوتنبرگ', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه تقویم شمسی در ویرایشگر گوتنبرگ فعال خواهد شد.', 'persian-calendar' ),
                'icon' => 'dashicons-edit',
            ],
            'regional_settings' => [
                'label' => __( 'تنظیمات منطقه‌ای', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه منطقه زمانی وب‌سایت به ایران و شروع هفته از روز شنبه تنظیم خواهد شد.', 'persian-calendar' ),
                'icon' => 'dashicons-admin-site-alt3',
            ],
            'enable_persian_digits' => [
                'label' => __( 'اعداد فارسی', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه اعداد انگلیسی به اعداد فارسی در تاریخ‌ها تبدیل خواهند شد.', 'persian-calendar' ),
                'icon' => 'dashicons-editor-ol',
            ],
            'enable_dashboard_font' => [
                'label' => __( 'فونت پیشخوان', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه فونت فارسی واضح و زیبا برای پیشخوان وردپرس اعمال خواهد شد.', 'persian-calendar' ),
                'icon' => 'dashicons-editor-textcolor',
            ],
            'permalink_jalali_date' => [
                'label' => __( 'پیوندهای یکتای شمسی', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه تاریخ‌های موجود در آدرس مطالب به شمسی تبدیل خواهند شد.', 'persian-calendar' ),
                'icon' => 'dashicons-admin-links',
            ],
            'enable_edd_compatibility' => [
                'label' => __( 'سازگاری با EDD', 'persian-calendar' ),
                'desc' => __( 'با فعال کردن این گزینه تاریخ‌های موجود در گزارشات Easy Digital Downloads به شمسی تبدیل خواهند شد.', 'persian-calendar' ),
                'icon' => 'dashicons-chart-bar',
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
                        <h4><?php esc_html_e( 'تنظیمات تقویم فارسی', 'persian-calendar' ); ?></h4>
                        <p><?php esc_html_e( 'پیکربندی تبدیل تاریخ شمسی و اعداد فارسی برای سایت وردپرس شما', 'persian-calendar' ); ?></p>
                    </div>
                </div>
                <div class="persian-calendar-logo">
                    <img src="<?php echo esc_url(PC_PLUGIN_URL . 'assets/images/icon.png'); ?>" alt="Persian Calendar Logo">
                </div>
            </div>

            <!-- Main Content -->
            <div class="persian-calendar-main">
                <!-- Content -->
                <div class="persian-calendar-content">
                    <div class="persian-calendar-card">
                        <div class="persian-calendar-card-header">
                            <h4><?php esc_html_e( 'تنظیمات عمومی', 'persian-calendar' ); ?></h4>
                        </div>
                        <div class="persian-calendar-card-body">
                            <form id="persian-calendar-form" method="post" action="options.php">
                                <?php
                                settings_fields( 'persian_calendar' );
                                wp_nonce_field( 'persian_calendar_settings', 'persian_calendar_nonce' );
                                $this->render_settings_fields();
                                ?>
                            </form>
                        </div>
                    </div>
                    <button type="submit" form="persian-calendar-form" class="persian-calendar-submit">
                        <?php esc_html_e( 'ذخیره تغییرات', 'persian-calendar' ); ?>
                    </button>
                </div>

                <!-- Sidebar -->
                <div class="persian-calendar-sidebar">
                    <!-- About Plugin -->
                    <div class="persian-calendar-about">
                        <div class="persian-calendar-about-header">
                        </div>
                        <p><?php esc_html_e( 'افزونه تقویم فارسی، تاریخ‌های میلادی را به شمسی در وردپرس تبدیل می‌کند.', 'persian-calendar' ); ?></p>
                        <p><?php esc_html_e( 'مناسب برای وب‌سایت‌های فارسی', 'persian-calendar' ); ?></p>
                    </div>

                    <!-- Premium Ad -->
                    <div class="persian-calendar-premium-ad">
                        <div class="premium-ad-content">
                            <h5><?php esc_html_e( 'نیاز به امکانات بیشتر دارید؟', 'persian-calendar' ); ?></h5>
                            <p><?php esc_html_e( 'دسترسی به امکانات پیشرفته تقویم شمسی و پشتیبانی ویژه.', 'persian-calendar' ); ?></p>
                            <a href="<?php echo esc_url( '#' ); ?>" class="premium-ad-button"><?php esc_html_e( 'اطلاعات بیشتر', 'persian-calendar' ); ?></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}